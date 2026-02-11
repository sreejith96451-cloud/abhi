const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "anonymous_chat"
});

db.connect(err => {
  if (err) return console.error("MySQL connection failed:", err);
  console.log("MySQL Connected");
});

// Spam control
const spamTracker = {};
const MAX_MSG = 3;

// Auto-delete messages older than 24 hours
setInterval(() => {
  db.query(
    "DELETE FROM messages WHERE created_at < NOW() - INTERVAL 1 DAY",
    err => { if(err) console.error("Auto delete error"); }
  );
}, 60*60*1000);

// ================= STUDENT =================
app.post("/send-message", (req, res) => {
  const ip = req.ip;
  const { message, studentId } = req.body;

  if(!message || !studentId) return res.json({success:false,msg:"Invalid data"});
  
  if(!spamTracker[ip]) spamTracker[ip]=0;
  if(spamTracker[ip]>=MAX_MSG) return res.json({success:false,msg:"Spam limit reached"});
  
  spamTracker[ip]++;
  db.query("INSERT INTO messages (message, student_id) VALUES (?,?)",[message,studentId],err=>{
    if(err) return res.json({success:false});
    res.json({success:true});
  });
});

app.get("/my-reply/:studentId",(req,res)=>{
  const {studentId} = req.params;
  db.query(
    "SELECT private_reply FROM messages WHERE student_id=? AND private_reply IS NOT NULL ORDER BY id DESC LIMIT 1",
    [studentId],
    (err,result)=>{
      if(err || result.length===0) return res.json({});
      res.json(result[0]);
    }
  );
});

// ================= ADMIN =================
app.get("/messages",(req,res)=>{
  db.query("SELECT * FROM messages ORDER BY id DESC",(err,result)=>{
    if(err) return res.json([]);
    res.json(result);
  });
});

app.post("/approve",(req,res)=>{
  const {id} = req.body;
  db.query("UPDATE messages SET approved=1 WHERE id=?",[id],err=>{
    if(err) return res.json({success:false});
    res.json({success:true});
  });
});

app.post("/private-reply",(req,res)=>{
  const {id,reply} = req.body;
  db.query("UPDATE messages SET private_reply=? WHERE id=?",[reply,id],err=>{
    if(err) return res.json({success:false});
    res.json({success:true});
  });
});

// Clear spam tracker route
app.post("/clear-spam",(req,res)=>{
  for(let key in spamTracker) delete spamTracker[key];
  res.json({success:true});
});

// Start server
app.listen(3001,()=>console.log("Server running on port 3001"));