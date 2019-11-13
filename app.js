const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');


const app = express();
const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver(
  'bolt://localhost',
  neo4j.auth.basic('neo4j', 'fakenews'),
  {database:'fakenews'}
);

const session = driver.session();
const id1='AWEBRBJ8yCdS-nWhunDm'.replace('-','');
const id2='AWEMi_sOhutQxxU6tp-E'.replace('-','');
const text1=`木耳發泡超8小時，變質後的細菌量將暴增數倍至幾十倍！而浙江陳先生吃的木耳泡了72小時之多，細菌量更是百倍地暴增！`;
const text2=`公告：嘉市環保局便民服務，每日晚上十點半至凌晨三點，會有一台垃圾車，定點在嘉女高中對面，提拱服務。全年無休，只休除夕一天，`
const userId1='user_1';
const userId2='user_2';
const roomId1='room_1';
const roomId2='room_2';
const roomId3='room_3';
const roomId4='room_4';
(async()=>{
  try {
    await session.run(`MATCH (n) DETACH DELETE n`);

    await session.run(`
    CREATE 
    (${id1}:Rumor {id:'${id1}',text:'${text1}'}),
    (${id2}:Rumor {id:'${id2}',text:'${text2}'}),

    (${userId1}:LineUser {userId:'${userId1}'})
    -[:TALK_IN]->
    (${roomId1}:Room {roomId:'${roomId1}'})
    -[:SPREAD]->
    (${id1}),
    (${userId1})
    -[:TALK_IN]->
    (${roomId3}:Room {roomId:'${roomId3}'})
    -[:SPREAD]->
    (${id2}),

    (${userId2}:LineUser {userId:'${userId2}'})
    -[:TALK_IN]->
    (${roomId2}:Room {roomId:'${roomId2}'})
    -[:SPREAD]->
    (${id1}),
    (${userId2})
    -[:TALK_IN]->
    (${roomId4}:Room {roomId:'${roomId4}'})
    -[:SPREAD]->
    (${id1})
    `);
    const result= await session.run(`
    MATCH (AWEMi_sOhutQxxU6tpE {id:'AWEMi_sOhutQxxU6tpE'})
    <-[:SPREAD]-(r:Room)
    <-[:TALK_IN]-(u:LineUser) 
    RETURN u.userId
    `)
    
    result.records.forEach((record)=>{
      console.log(record);
    })
    
  } catch (e) {
   console.error(e) 
  }
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

app.post('/valid-fakenews', (req,res,next)=>{
  res.json({valid_result:true})
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
