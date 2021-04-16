
require('dotenv').config({ path: '.env' });
const PORT = process.env.PORT_SERVER || 8001;
const path = require('path');
const bcrypt = require('bcrypt');

const { Sequelize, DataTypes, Op } = require('sequelize');
const express = require('express');
const app = express();

const cookieSession = require('cookie-session');
app.use(cookieSession({
  name: process.env.COOKIE_NAME,
  secret: process.env.COOKIE_SECRET,
  maxAge: parseInt(process.env.COOKIE_AGE) * 60 * 60 * 1000,
  httpOnly: true
}));

app.use(express.json());
app.use('/static', express.static(path.resolve(__dirname, 'public')));
const S_UID = 'userID';

const DB = initDB();
const constraints = {
  username: {
    badChars: /\W/,
    minSize: 4,
    maxSize: 20,
  },
  password: {
    minSize: 8,
  },
  note_title: {
    //badChars: /\W/,
    badChars: /[^a-zA-Z]/,
    minSize: 3,
    maxSize: 30,
  },
  note_content: {
    //badChars: /\W/,
    badChars: /[^\w\s\.,\?!'"]/,
    maxSize: 1000,
  },
  search: {
    badChars: /[^\w\s\.,\?!'"]/,
  }
};


// create account
app.post('/api/user', async (req, res) => {
  if (req.body.username == undefined || req.body.pw == undefined) {
    res.json({ ok: 0, payload: 'missing required input' });
    return;
  }
  const username = req.body.username.toLowerCase();

  if (username.match(constraints.username.badChars) ||
    username.length < constraints.username.minSize ||
    username.length > constraints.username.maxSize) {
    res.json({ ok: 0, payload: 'invalid username!' });
    return;
  }

  const existing = await DB.user.findOne({where: {username: username}});
  if (existing) {
    res.json({ ok: 0, payload: 'username already exists!' });
  }
  else {
    if (req.body.pw.length < constraints.password.minSize) {
      res.json({ ok: 0, payload: 'invalid password!' });
      return;
    }

    const hashedPW = await bcrypt.hash(req.body.pw, 5);
    if (hashedPW) {
      const newUser = await DB.user.create({ username: username, pw: hashedPW });
      req.session[S_UID] = newUser.id;
      res.json({ ok: 1, payload: 'Welcome to Notes!' });
    }
    else {
      res.json({ ok: 0, payload: 'oops, cannot hash supplied password!' });
    }
  }
});

// user routes

// auth
app.post('/api/auth', async (req, res) => {
  if (req.body.username == undefined || req.body.pw == undefined) {
    res.json({ ok: 0, payload: 'missing required input' });
    return;
  }

  const username = req.body.username.toLowerCase();
  if (username.match(constraints.username.badChars)) {
    res.json({ ok: 0, payload: 'illegal chars in username!' });
    return;
  }
  const user = await DB.user.findOne({where: {username: username}});
  let ok = 1, msg = '';
  if (user) {
    const pwMatch = await bcrypt.compare(req.body.pw, user.pw);
    if (pwMatch) {
      req.session[S_UID] = user.id;
      res.json({ ok: 1, payload: 'Welcome back to Notes!' });
      return;
    }
    // else
    ok = 0;
    msg = 'invalid credentials';
  }
  else {
    ok = 0;
    msg = 'unknown username';
  }
  res.json({ ok: 0, payload: msg });
});

// logout
app.get('/api/logout', (req, res) => {
  req.session = null
  res.json({ ok: 1, payload: 'logged out' });
});


// note routes

// list
app.get('/api/list', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const notes = await DB.note.findAll({
    where: {
      user_id: parseInt(req.session[S_UID])
    },
    order: ['note_title']
  });

  res.json({ ok: 1, payload: notes});
});

// view
app.get('/api/note/:id', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const note = await DB.note.findOne({
    where: {
      user_id: parseInt(req.session[S_UID]),
      id: parseInt(req.params.id)
    }
  });

  if (note) {
    res.json(note);
  }
  else {
    res.json({ ok: 0, payload: 'not found' });
  }
});

// search
app.get('/api/search/:pattern', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const str = req.params.pattern;
  if (str.match(constraints.search.badChars)) {
    res.json({ ok: 0, payload: 'invalid search string' });
    return;
  }

  const notes = await DB.note.findAll({
    where: {
      user_id: parseInt(req.session[S_UID]),
      [Op.or]: [
        {
          note_title: { [Op.like]: '%'+req.params.pattern+'%' }
        },
        {
          note_content: { [Op.like]: '%'+req.params.pattern+'%' }
        }
      ]
    }
  });

  if (notes) {
    res.json({ ok: 1, payload: notes });
  }
  else {
    res.json({ ok: 0, payload: 'nothing found' });
  }
});

// create
app.post('/api/note', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const title = req.body.note_title;
  if (title.match(constraints.note_title.badChars) || title.length > constraints.note_title.size) {
    res.json({ ok: 0, payload: 'invalid title' });
    return;
  }

  const existing = await DB.note.findOne({
    where: {
      user_id: parseInt(req.session[S_UID]),
      note_title: title
    }
  });
  if (existing) {
    res.json({ ok: 0, payload: 'note already exists!' });
    return;
  }

  const content = req.body.note_content;
  if (content.match(constraints.note_content.badChars) || content.length > constraints.note_content.size) {
    res.json({ ok: 0, payload: 'invalid content' });
    return;
  }

  // else
  const newNote = await DB.note.create({
    user_id: parseInt(req.session[S_UID]),
    note_title: title,
    note_content: content
  });
  res.json({ ok: 1, payload: newNote.id });
});

// update
app.patch('/api/note/:id', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const note = await DB.note.findOne({
    where: {
      user_id: parseInt(req.session[S_UID]),
      id: parseInt(req.params.id)
    }
  });
  if (! note) {
    res.json({ ok: 0, payload: 'not found' });
    return;
  }

  const title = req.body.note_title;
  if (title.match(constraints.note_title.badChars) || title.length > constraints.note_title.size) {
    res.json({ ok: 0, payload: 'invalid title' });
    return;
  }

  const content = req.body.note_content;
  if (content.match(constraints.note_content.badChars) || content.length > constraints.note_content.size) {
    res.json({ ok: 0, payload: 'invalid content' });
    return;
  }

  await DB.note.update({
    note_title: title,
    note_content: content
  },
  { where: { id: note.id } });

  res.json({ ok: 1, payload: 'updated' });
});

// delete
app.delete('/api/note/:id', async (req, res) => {
  if (!(S_UID in req.session)) {
    res.json({ ok: 0, payload: 'login required' });
    return;
  }

  const existing = await DB.note.findOne({
    where: {
      user_id: parseInt(req.session[S_UID]),
      id: parseInt(req.params.id)
    }
  });
  if (!existing) {
    res.json({ ok: 0, payload: 'not found!' });
    return;
  }
  // else
  await DB.note.destroy({ where: { id: existing.id } });
  res.json({ ok: 1, payload: req.params.id });
});


// the rest (static)
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});


const server = app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});


function initDB() {
  const db = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(__dirname, 'data/'+process.env.DB_NAME)
  });

  const User = db.define('user', {
    username: {
      type: DataTypes.STRING,
      allowNull: false
    },
    pw: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });
  User.sync();

  const Note = db.define('note', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    note_title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    note_content: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  });
  Note.sync();

  return { user: User, note: Note };
}
