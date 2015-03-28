'use strict';
/*global Showdown, React, unescape*/
var converter = new Showdown.converter();
var convertToUtf8 = function (str) {
    return unescape(encodeURIComponent(str));
};

var PublicMessage = React.createClass({
    render: function () {
        var rawMarkup = converter.makeHtml(this.props.children.toString());
        return (
             <tr>
                <td className="name">{this.props.author.user_name}</td>
                <td dangerouslySetInnerHTML={{__html: rawMarkup}} />
            </tr>
        );
    }
});

var UserName = React.createClass({
    handleSubmit: function(e) {
        console.log('userName handlesubmit');
        e.preventDefault();
        var user_name = this.refs.user_name.getDOMNode().value.trim();
        if (!user_name) {
            return;
        }
        this.props.onChangeUserName(user_name);
        return;
    },
    render: function() {
        var user = this.props.users.filter(function (user) {
            return this.props.userid === user.id;
        }, this);
        var user_name = 'Enter Your Name';
        if (user.length && user[0].user_name) {
            user_name = user[0].user_name;
        }
        return (
            <form className="commentForm" onSubmit={this.handleSubmit}>
                <input type="text" placeholder={user_name} ref="user_name" />
            </form>
        );
    }
});

var MessageBox = React.createClass({
    handlePublicMessage: function(message) {
        console.log('messageBox handleMessageSubmit', this.state.ws, message);
        if (this.state.ws) {
            var data = JSON.stringify({action: 'broadcast', message: message});
            data = convertToUtf8(data);
            var packet = Packetizer.createPacket(new jDataView(data));
            console.log('sending packet', packet.getBytes(packet.byteLength, 0));
            this.state.ws.send(packet.getBytes(packet.byteLength, 0));
        }
    },
    handleChangeUserName: function(user_name) {
        console.log('messageBox handleChangeUserName', user_name);
        if (this.state.ws) {
            var data = JSON.stringify({action: 'set_user', user_name: user_name});
            data = convertToUtf8(data);
            var packet = Packetizer.createPacket(new jDataView(data));
            console.log('sending packet', packet.getBytes(packet.byteLength, 0));
            this.state.ws.send(packet.getBytes(packet.byteLength, 0));
        }
    },
    getInitialState: function() {
        return {messages: [{type:'welcome'}], users: [], ws: null, id: -1};
    },
    componentDidMount: function() {
        console.log('componentDidMount');
        var protocol = new WSProtocol();
        protocol.on('message', function (command) {
            console.log('got command:', command);
            switch (command.action) {
            case 'join':
                var id = command.id;
                var user_name = command.user_name || '';
                console.log('join', id, user_name);
                var users = this.state.users.slice();
                users.push({id: id, user_name: user_name});
                var messages = this.state.messages.slice();
                messages.push({type: 'join', id: id});
                this.setState({users: users, messages: messages});
                return;
            case 'welcome':
                var id = command.id;
                var users = command.users;
                this.setState({id: id, users: users});
                return;
            case 'leave':
                var id = command.id;
                var users = this.state.users.slice();
                users.forEach(function (user, i) {
                    if (user.id === id) {
                        user.gone = true;
                    }
                });
                var messages = this.state.messages.slice();
                messages.push({type: 'leave', id: id});
                this.setState({users: users, messages: messages});
                return;
            case 'change_user_name':
                var id = command.id;
                var user_name = command.user_name;
                var users = this.state.users.slice();
                var old_name = '';
                users.forEach(function (user) {
                    if (user.id === id) {
                        old_name = user.user_name;
                        user.user_name = user_name;
                    }
                });
                var messages = this.state.messages.slice();
                messages.push({type: 'rename', old: old_name, new: user_name});
                this.setState({users: users, messages: messages});
                return;
            case 'message':
                var from_id = command.from_id;
                var message = command.message;
                var messages = this.state.messages.slice();
                messages.push({type: 'private', from: from_id, message: message});
                this.setState({messages: messages});
                return;
            case 'broadcast':
                var from_id = command.from_id;
                var message = command.message;
                var messages = this.state.messages.slice();
                messages.push({type: 'public', from: from_id, message: message});
                this.setState({messages: messages});
                return;
            }
        }.bind(this));
    },
    render: function() {
        return (
            <div className="messageBox">
                <UserName onChangeUserName={this.handleChangeUserName} userid={this.state.id} users={this.state.users} />
                <MessageList messages={this.state.messages} users={this.state.users} />
                <MessageForm onPublicMessage={this.handlePublicMessage} />
            </div>
        );
    }
});

var User = React.createClass({
    render: function () {
        return (
            <div className="user">{this.props.user_name}</div>
        );
    }
});

var UserList = React.createClass({
    render: function () {
        var userNodes = this.props.users.filter(function (user) {
            return !user.gone;
        }).map(function (user, index) {
            return (
                    <User user_name={user.user_name} userid={user.id} key={index} />
            );
        }, this);
        return (
            <div className="userList">
                {userNodes}
            </div>
        );
    }
});

var MessageList = React.createClass({
  render: function() {
      var messageNodes = this.props.messages.map(function(message, index) {
          console.log('message:', message);
          var num_rows = 1 + this.props.messages.length;
          if (message.type === 'welcome') {
              return (
                  <tr>
                      <td colSpan="2">Welcome To Chat</td>
                      <td rowSpan={num_rows} className="name"><UserList users={this.props.users} /></td>
                  </tr>
              );
          }
          if (message.type !== 'public') {
              var json = JSON.stringify(message);
              return (
                  <tr>
                      <td colSpan="2">{json}</td>
                  </tr>
              );
          }
          var sender;
          this.props.users.forEach(function (user) {
              if (user.id === message.from) {
                  sender = user;
              }
          });
          return (
              <PublicMessage author={sender} key={index}>
                  {message.message}
              </PublicMessage>
          );
      }, this);
      return (
          <table>
              <tbody>
                  {messageNodes}
              </tbody>
          </table>
      );
  }
});

var MessageForm = React.createClass({
    handleSubmit: function(e) {
        console.log('messageform handlesubmit');
        e.preventDefault();
        var text = this.refs.text.getDOMNode().value.trim();
        if (!text) {
            return;
        }
        this.props.onPublicMessage(text);
        this.refs.text.getDOMNode().value = '';
        return;
    },
    render: function() {
        var style = {
            width: '100%'
        };
        return (
            <form className="commentForm" onSubmit={this.handleSubmit}>
                <input style={style} type="text" placeholder="Say something..." ref="text" />
            </form>
        );
    }
});

React.render(
  <MessageBox />,
  document.getElementById('content')
);
