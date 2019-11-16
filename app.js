require('dotenv').config()
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const rp = require('request-promise');

const {
  FAKENEWS_DATA_SERVER_DMAINNAME,
  NEO4J_HOST,
}=process.env

console.log('FAKENEWS_DATA_SERVER_DMAINNAME',FAKENEWS_DATA_SERVER_DMAINNAME)
console.log('NEO4J_HOST',NEO4J_HOST)


const app = express();
const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver(
  `bolt://${NEO4J_HOST}`,
  neo4j.auth.basic('neo4j', 'fakenews')
);

(async()=>{
  const session = driver.session();
  //await session.run(`MATCH (n) DETACH DELETE n`);
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

const findRumorSource=async(id)=>{
  const session = driver.session();
  const userList= await session.run(`
  MATCH (${id}:Rumor)
  <-[:SPREAD]-(r:Room)
  <-[:TALK_IN]-
  (user:LineUser)
  RETURN user
  `)
  return userList;
}

app.post('/valid-fakenews',async (req,res,next)=>{
    try {
      const session = driver.session();
      console.log('[req.body]',req.body);
      const {roomId,userId,text}=req.body;
      let response
      const options = {
        method: 'POST',
        uri: `${FAKENEWS_DATA_SERVER_DMAINNAME}/isFakeNews`,
        formData: {
          text: text
        },
        json: true // Automatically stringifies the body to JSON
      };
      console.log('[options]',options)
      try {
        response=await rp(options);
      } catch (e) {
        console.error('[request fake_news_store failed]',e.message)
        throw e
      }
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
          (${userId}:LineUser {userId:'${userId}'})
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
          (${userId}:LineUser {userId:'${userId}'})
          -[:TALK_IN]->
          (${roomId})
          -[:SPREAD]->
          (${id})
          `);
        }
        session.close();
         const userList=await findRumorSource(id);
         const total=userList.records.length;
         const lastIndex=userList.records.length-1;
         const source=userList.records[lastIndex]._fields[0].properties.userId;
        res.json({is_fake:'YES',source,userList}); 
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
