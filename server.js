const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname,'public')));

app.post('/upload',(req,res)=>{
    res.sendStatus(200);
})

app.listen(8080,()=>{
    console.log('App listening on port 8080');
})