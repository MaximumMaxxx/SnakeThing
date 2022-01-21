// Use ES6
"use strict";

// Express & Socket.io deps
var express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');
var bodyParser = require('body-parser');

var mysql = require('mysql2')

const Snake = require('./snake');
const Apple = require('./apple');
const { connect } = require('http2');

// ID's seed
let autoId = 0;
// Grid size
const GRID_SIZE = 40;
// Remote players 
let players = [];
// Apples 
let apples = [];


app.use(express.static("public"));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);

app.use(bodyParser.urlencoded({ extended: true }));
//form-urlencoded

/* CONNECT TO THE DATABASE */
var connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'snakeybase'
})

connection.connect(function (err) {

  if (err) throw err;
  var sql = 'CREATE TABLE IF NOT EXISTS snakeybase (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), password VARCHAR(255), highScore INT)'

  connection.query(sql, function (err, result) {
    if (err) throw err;
    console.log("Table created successfully")
  });
});



/*
 * Serve client
 */
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

//app.get login
app.get('/login', function (req, res) {
  res.render('login.html', { error: '' });
});

//app.post login
app.post('/login', function (req, res) {
  var name = req.body.username;
  var password = req.body.password;

  var sql = 'SELECT name, highScore from snakeybase where name = ? AND password = ?';

  con.query(sql, [name, password], (err, result) => {
    if (err) throw err;

    if (result.length > 0) {
      var highScore = result[0].highScore;

      res.render("game.html", { Nickname: name, HighScore: highScore });
    } else {
      res.render('login.html', { error: "Invalid username or password" })
    }
  });
})

//app.get signup
app.get('/signup', function (req, res) {
  res.render('signup.html', { error: '' });
});

//app.post signup
app.post('/signup', function (req, res) {
  var name = req.body.username;
  var password = req.body.password;
  var confirmPassword = req.body.confirmPassword;
  var highScore = '';

  if (password !== confirmPassword) {
    res.render('signup.html', { error: 'incorrect password' });
  }

  var sql = 'SELECT name from snakeybase where name = ?';

  con.query(sql, function (err, result) {
    if (err) throw err;

    if (result.legth > 0) {
      res.render('signup.html', { error: 'username is already taken' })
    } else {
      var sql = 'INSERT INTO snakeybase (name,password,highScore) VALUES ?';
      var highScore = 0;
      let values = [[name, password, highScore]];

      con.query(sql, values, function (err, result) {
        if (err) throw err;
        console.log(`Number of records inseted: ${result.affectedRows}`);
      });
    }
  });

  res.render('game.html', { Nickname: name, highScore: highScore })
})


app.post('/game', function (req, res) {
  var name = req.body.nickname;
  var highestScore = '';
  res.render('game.html', { Nickname: name, highestScore: highestScore });

});

http.listen(3000, () => {
  console.log('listening on *:3000');
});


/*
 * Listen for incoming clients
 */
io.on('connection', (client) => {
  let player;
  let id;
  let color;

  function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var get_color = '#';
    for (var i = 0; i < 6; i++) {
      get_color += letters[Math.floor(Math.random() * 16)];
    }
    return get_color;
  }

  client.on('auth', (opts, cb) => {
    // Create player
    id = ++autoId;
    color = getRandomColor();
    player = new Snake(_.assign({
      id, color,
      dir: 'right',
      gridSize: GRID_SIZE,
      snakes: players,
      apples
    }, opts));
    players.push(player);
    // Callback with id
    cb({ id: autoId });
  });

  // Receive keystrokes
  client.on('key', (key) => {
    // and change direction accordingly
    if (player) {
      player.changeDirection(key);
    }
  });

  // Remove players on disconnect
  client.on('disconnect', () => {
    var name = player.nickname;

    var sql = 'SELECT name, highScore FROM players WHERE name = ?'

    con.query(sql, [name], (err, result) => {
      if (err) throw err;

      if (result[0].highScore < player.points) {
        var sql = "UPDATE snakebase SET highScore = ? WHERE name = ?";
        var newScore = player.points;

        con.query(sql, [newScore, name], (err, result) => {
          if (err) throw err;
          console.log(newScore)

        })
      }
    })
  });
  _.remove(players, player)
});

// Create apples
for (var i = 0; i < 3; i++) {
  apples.push(new Apple({
    gridSize: GRID_SIZE,
    snakes: players,
    apples
  }));
}

// Main loop
setInterval(() => {
  players.forEach((p) => {
    p.move();
  });
  io.emit('state', {
    players: players.map((p) => ({
      x: p.x,
      y: p.y,
      id: p.id,
      color: p.color,
      nickname: p.nickname,
      points: p.points,
      tail: p.tail
    })),
    apples: apples.map((a) => ({
      x: a.x,
      y: a.y
    }))
  });
}, 100);