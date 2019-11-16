require('dotenv').config()
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const rp = require('request-promise');

const app = express();
const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver(
  'bolt://localhost',
  neo4j.auth.basic('neo4j', 'fakenews')
);

(async()=>{
  const session = driver.session();
  await session.run(`MATCH (n) DETACH DELETE n`);
  session.close();
  driver.close();
})()

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req,res,next)=>{
  res.sned('hello world')
});

app.use('/valid-fakenews',(req,res,next)=>{
  const {roomId,userId,text}=req.body;

  if(!roomId || !userId|| !text){
    res.status=400;
    res.json({err_message:'INVALID_PARAMETER'});
  }else{
    next();
  }
})

app.post('/isFakeNews',(req,res,next)=>{
  res.json({
    articleId:'AWEMi_sOhutQxxU6tp-E',
    fakeNews:true
  })
})

app.post('/valid-fakenews',async (req,res,next)=>{
    try {
      const session = driver.session();
    console.log('[req.body]',req.body);
    const {roomId,userId,text}=req.body;
    const options = {
      method: 'POST',
      uri: `${FAKENEWS_DATA_SERVER_HOST}:${FAKENEWS_DATA_SERVER_PORT}/isFakeNews`,
      formData: {
        text: text
      },
      json: true // Automatically stringifies the body to JSON
    };
    console.log('[options]',options)
    const response=await rp(options);
    console.log('[response]',response)
    if(response.articleId===null && response.fakeNews===false){
      res.json({
        is_fake:'NO'
      })
    }else if(typeof response.articleId ==='string' && response.fakeNews===true){
      const id='`'+response.articleId+'`';

      const rumorResult= await session.run(`
      MATCH (${id}:Rumor {id:'${id}',text:'${text}'})
      RETURN ${id}
      `)
      if(rumorResult.records.length===0){
        await session.run(`
        CREATE 
        (${id}:Rumor {id:'${id}',text:'${text}'})
        `);
      }

      const userSpreadRumorInRoomResult= await session.run(`
      MATCH (${id}:Rumor {id:'${id}',text:'${text}'})
      <-[:SPREAD]-(r:Room {roomId:'${roomId}'})
      RETURN r.roomId
      `)
      if(userSpreadRumorInRoomResult.records.length===0){
        await session.run(`
        MATCH (${id}:Rumor {id:'${id}',text:'${text}'})
        CREATE 
        (${userId}:LineUser {userId:'${userId}',name:'${new Date().getTime()}'})
        -[:TALK_IN]->
        (${roomId}:Room {roomId:'${roomId}'})
        -[:SPREAD]->
        (${id})
        `);
      }else{
        await session.run(`
        MATCH (${id}:Rumor {id:'${id}',text:'${text}'})
        MATCH (${roomId}:Room {roomId:'${roomId}'})
        CREATE 
        (${userId}:LineUser {userId:'${userId}',name:'${new Date().getTime()}'})
        -[:TALK_IN]->
        (${roomId})
        -[:SPREAD]->
        (${id})
        `);
      }
      res.json({is_fake:'YES'}); 
      session.close();
    }else{
      res.json({is_fake:'UNKNOWN'})
    }
  } catch (e) {
    console.error('[error]',e.message)
   res.status=500;
   res.json({'err_message':e.message}) 
  }
  });

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
