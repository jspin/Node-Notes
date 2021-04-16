
const noteApp = () => {

  const fetchHeaders = { 'Content-type': 'application/json' };

  function initNote(obj) {
    if (obj) {
      //console.log('clone it from '+initNote.caller);
      const clone = {};
      for (const k in obj) {
        clone[k] = obj[k];
      }
      return clone;
    }
    // else
    return {
      id: 0,
      note_title: '',
      note_content: ''
    }
  }

  Vue.component('login', {
    template: '#login',
    props: ['action', 'err_msg'],
    data: function() {
      return { creds: {} }
    },
    methods: {
      login: function(e) {
        this.creds.username = this.creds.username.toLowerCase();
        const pw = this.creds.pw;
        this.creds.pw = '';
        this.$emit('login', this.action, {
          username: this.creds.username,
          pw: pw
        });
      }
    }
  });

  Vue.component('search', {
    template: '#search',
    data: function() {
      return {
        searchTerm: '',
        message: ''
      }
    },
    methods: {
      search: function() {
        //this.searchTerm = this.searchTerm.replace(/[^\w\s/]/g,'').replace(/\s{2,}/, ' ');
        if (this.searchTerm.length < 3) {
          this.message = 'please enter a longer search string';
          return;
        }
        // else
        this.message = '';
        this.$emit('search', this.searchTerm)
      }
    },
  });

  Vue.component('editor', {
    template: '#editor',
    props: [ 'note' ],
    data: function() { return { } },
    computed: {
      action() {
        return this.note.id > 0 ? 'Update' : 'Add'
      }
    },
    methods: {
      save: function() {
        this.$emit('save', this.note)
      }
    }
  });

  Vue.component('noterow', {
    template: '#noterow',
    props: ['note', 'note_index'],
    data: function() { return { } },
    methods: {
      toggleView: function() {
         this.show = !this.show;
      },
    }
  });

  const view = new Vue({
    el: '#app',
    data: {
      notes: [],
      notesShown: [],
      searchTerm: '',
      selectedNote: initNote(),
      loginErr: '',
      noteMsg: '',
      loggedIn: false,
      showEdit: false,
      showList: false,
    },
    methods: {
      loginOrSignup(action, creds) {
        const path = action == 'Signup' ? 'user' : 'auth';
        let that = this;
        fetch('/api/'+path, {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify(creds)
        })
        .then(response => response.json())
        .then(response => {
          if (response.ok != 1) {
            that.loginErr = response.payload;
          }
          else {
            that.loginErr = '';
            that.loggedIn = true;
            that.showEdit = true;
            if (path == 'auth') {
              that.getNotes();
            }
          }
        })
        .catch(function (error) {
          //console.error(error.message);
          that.loginErr = 'Sorry, an error occurred during login. Please try again or contact support.';
        });
      },
      logout() {
        let that = this;
        fetch('/api/logout', { headers: fetchHeaders })
        .then(response => response.json())
        .then(response => {
          if (response.ok != 1) {
            that.loginErr = response.payload;
          }
          else {
            that.showEdit = false;
            that.showList = false;
            that.loggedIn = false;
            that.notes = [];
            that.notesShown = [];
            that.selectedNote = initNote();
          }
        })
        .catch(function (error) {
          //console.error(error.message);
          that.loginErr = 'Sorry, an error occurred during logout. Please try again or contact support.';
        });
      },
      listNotes(str) {
        if (str == undefined || typeof(str) != 'string') {
          if (this.notes.length == 0) {
            this.noteMsg = 'You have no notes, so why not create one now';
            this.notesShown = initNote();
            this.showEdit = true;
            this.showList = false;
            return;
          }
          this.notesShown = [];
          this.notes.forEach(item => {
            this.notesShown.push(initNote(item));
          });
        }
        else {
          this.notesShown = this.notes.filter(item => {
            return item.note_title.includes(str) || item.note_content.includes(str)
          });
        }

        // truncate the potentially long content
        this.notesShown.forEach(item => {
          item.note_content = item.note_content.substr(0,150);
        });
        this.showEdit = false;
        this.showList = true;
        this.noteMsg = '';
      },
      saveNote(note) {
        let path = '/api/note';
        let method = 'POST';

        if (note.id > 0) {
          path += '/'+note.id;
          method = 'PATCH';
        }
        let that = this;
        fetch(path, {
          method: method,
          headers: fetchHeaders,
          body: JSON.stringify(note)
        })
        .then(response => response.json())
        .then(response => {
          if (response.ok != 1) {
            that.noteMsg = response.payload;
          }
          else {
            if (note.id > 0) {
              that.notes.every(item => {
               if (item.id == note.id) {
                 item = note;
                 return false;
               }
              });
            }
            else {
              that.selectedNote.id = response.payload;
              that.notes.push(that.selectedNote);
            }
            that.noteMsg = 'Note saved';
          }
        })
        .catch(function (error) {
          //console.error(error.message);
          that.noteMsg = 'Sorry, an error occurred while saving. Please try again or contact support.';
        });
      },
      editNote: function(ix) {
        if (ix < 0) {
          this.selectedNote = initNote();
          this.noteMsg = '';
        }
        else {
          if (ix > this.notes.length) {
            this.noteMsg = 'Sorry, that note doesn\'t exist';
            return;
          }
          this.selectedNote = this.notes[ix];
        }
        this.showList = false;
        this.showEdit = true;
      },
      cancelEdit: function() {
        this.selectedNote = initNote();
        this.noteMsg = '';
      },
      deleteNote: function(id) {
        let that = this;
        fetch('/api/note/'+id, {
          method: 'DELETE',
          headers: fetchHeaders,
        })
        .then(response => response.json())
        .then(response => {
          if (response.ok != 1) {
            that.noteMsg = response.payload;
          }
          else {
            that.notes = that.notes.filter(item => item.id != id);
            that.selectedNote = initNote();
            that.listNotes();
          }
        })
        .catch(function (error) {
          //console.error(error.message);
          that.noteMsg = 'Sorry, an error occurred while deleting. Please try again or contact support.';
        });
      },
      getNotes: function() {
        let that = this;
        fetch('/api/list', { headers: fetchHeaders })
        .then(response => response.json())
        .then(response => {
          if (response.ok != 1) {
            if (response.payload != 'login required') {
              that.noteMsg = response.payload;
            }
          }
          else {
            that.loggedIn = true;
            that.notes = response.payload;
            that.listNotes();
          }
        })
        .catch(function (error) {
          //console.error(error.message);
          that.noteMsg = 'Sorry, an error occurred while fetching your notes. Please try again or contact support.';
        });
      }
    },
    created: function() {
      this.getNotes();
    }
  });
};
noteApp();
