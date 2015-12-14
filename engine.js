(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var Authorizer, Requester, debug;

debug = require('debug')('engine:authorizer');

Requester = require('./utils/requester');


/*
  @nodoc
 */

Authorizer = (function() {
  function Authorizer(engine) {
    this.engine = engine;
    void 0;
  }

  Authorizer.prototype.authorize = function(options, data, callback) {
    var authData, authEndpoint, authTransport, requestMethod;
    authEndpoint = options.authEndpoint || this.engine.options.authEndpoint;
    if (!authEndpoint) {
      Utils.throwError('authEndpoint is not configured.');
    }
    authTransport = options.authTransport || this.engine.options.authTransport;
    authData = options.authData || this.engine.options.authData;
    if (typeof authData === 'object') {
      authData = JSON.stringify(authData);
    }
    data.socketId = this.engine.connection.socketId;
    if (authData) {
      data.authData = authData;
    }
    if ((typeof window !== "undefined" && window !== null) && authTransport === 'jsonp') {
      requestMethod = Requester.jsonp;
    } else {
      requestMethod = Requester.post;
    }
    debug('send auth request', {
      authEndpoint: authEndpoint,
      data: data
    });
    return requestMethod(authEndpoint, data, function(err, authResult) {
      debug('got auth response', {
        err: err,
        authResult: authResult
      });
      if (err) {
        return callback({
          message: 'Wrong auth response',
          error: err
        });
      } else {
        return callback(null, authResult);
      }
    });
  };

  return Authorizer;

})();

module.exports = Authorizer;



},{"./utils/requester":33,"debug":38}],2:[function(require,module,exports){
'use strict';
var Channel, EventEmitter, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:channel');

EventEmitter = require('../utils/eventEmitter');


/*
  Channel 类

  事件
  -------------------------------
  - **engine:subscription_succeeded** 认证成功
      - 无参数
  - **engine:subscription_error** 认证失败
      - **error** (Object) ： error 信息
 */

Channel = (function(superClass) {
  extend(Channel, superClass);


  /*
    @nodoc
   */

  function Channel(name, engine) {
    var subscribed;
    this.name = name;
    this.engine = engine;
    subscribed = false;
  }


  /*
    @nodoc
   */

  Channel.prototype._authorize = function(callback) {
    return callback(null);
  };

  Channel.prototype.subscribe = function() {
    debug('subscribe', this.name);
    return this._authorize((function(_this) {
      return function(err, data) {
        if (err) {
          return _this.handleEvent({
            name: 'engine_channel:subscription_error',
            data: err
          });
        }
        return _this.engine.connection.sendEvent('engine_channel:subscribe', {
          channel: _this.name,
          signature: data != null ? data.signature : void 0,
          channelData: data != null ? data.channelData : void 0
        });
      };
    })(this));
  };

  Channel.prototype.unsubscribe = function() {
    debug('unsubscribe', this.name);
    return this.engine.connection.sendEvent('engine_channel:unsubscribe', {
      channel: this.name
    });
  };


  /*
    @nodoc
   */

  Channel.prototype.handleEvent = function(event) {
    switch (event.name) {
      case 'engine_channel:subscription_succeeded':
        this.subscribed = true;
        return this.trigger('engine:subscription_succeeded', event.data);
      case 'engine_channel:subscription_error':
        this.subscribed = false;
        return this.trigger('engine:subscription_error', event.data);
      default:
        return this.trigger(event.name, event.data);
    }
  };


  /*
    @nodoc
   */

  Channel.prototype.disconnect = function() {
    return this.subscribed = false;
  };

  return Channel;

})(EventEmitter);

module.exports = Channel;



},{"../utils/eventEmitter":30,"debug":38}],3:[function(require,module,exports){
'use strict';
var Channel, Channels, PresenceChannel, PrivateChannel, Protocol,
  hasProp = {}.hasOwnProperty;

Channel = require('./channel');

PrivateChannel = require('./privateChannel');

PresenceChannel = require('./presenceChannel');

Protocol = require('../protocol');


/*
  Channel 管理类，用户可以通过 engine.channels 获得
 */

Channels = (function() {

  /*
    @nodoc
   */
  function Channels(engine) {
    this.engine = engine;
    this._store = {};
  }


  /*
    @nodoc
   */

  Channels.prototype._createChannel = function(name) {
    if (name.indexOf('private-') !== -1) {
      return new PrivateChannel(name, this.engine);
    } else if (name.indexOf('presence-') !== -1) {
      return new PresenceChannel(name, this.engine);
    } else {
      return new Channel(name, this.engine);
    }
  };


  /*
    @nodoc
   */

  Channels.prototype._isConnected = function() {
    return this.engine.connection.state === 'connected';
  };


  /*
    订阅 Channel
    @example 订阅 Channel
      var coolChannel = engine.channels.subscribe('cool-channel');
    @param [String] channelName Channel Name
    @return [Channel]
   */

  Channels.prototype.subscribe = function(name) {
    var base, channel;
    Protocol.validateChannel(name);
    if ((base = this._store)[name] == null) {
      base[name] = this._createChannel(name);
    }
    channel = this._store[name];
    if (this._isConnected()) {
      channel.subscribe();
    }
    return channel;
  };


  /*
    取消订阅
    @example 取消订阅
      engine.channels.unsubscribe('cool-channel');
    @param [String] channelName Channel Name
    @return [void]
   */

  Channels.prototype.unsubscribe = function(name) {
    var ref;
    Protocol.validateChannel(name);
    if (this._isConnected()) {
      if ((ref = this._store[name]) != null) {
        ref.unsubscribe();
      }
    }
    return delete this._store[name];
  };


  /*
    获取已订阅的 Channel 实例
    @example 获取已订阅的 Channel 实例
      var coolChannel = engine.channels.find('cool-channel');
  
    @param [String] channelName Channel Name
    @return [Channel]
   */

  Channels.prototype.find = function(name) {
    Protocol.validateChannel(name);
    return this._store[name];
  };


  /*
    @nodoc
   */

  Channels.prototype.subscribeAll = function() {
    var channel, name, ref, results;
    if (!this._isConnected()) {
      return;
    }
    ref = this._store;
    results = [];
    for (name in ref) {
      if (!hasProp.call(ref, name)) continue;
      channel = ref[name];
      results.push(channel.subscribe());
    }
    return results;
  };


  /*
    @nodoc
   */

  Channels.prototype.disconnect = function() {
    var channel, name, ref, results;
    ref = this._store;
    results = [];
    for (name in ref) {
      if (!hasProp.call(ref, name)) continue;
      channel = ref[name];
      results.push(channel.disconnect());
    }
    return results;
  };

  return Channels;

})();

module.exports = Channels;



},{"../protocol":29,"./channel":2,"./presenceChannel":4,"./privateChannel":5}],4:[function(require,module,exports){
'use strict';
var PresenceChannel, PrivateChannel, Users,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

PrivateChannel = require('./privateChannel');

Users = require('./users');


/*
  PresenceChannel 类，在 {PrivateChannel} 的基础上，提供了在线用户的状态服务

  事件
  -------------------------------
  - **engine:subscription_succeeded** 认证成功时触发，处理函数将得到一个额外的参数 users
      - **users** (Object) ： 用户列表，该对象结构如下：

          ```js
          {
            // 该 Channel 上的当前在线用户数
            "count": 100,
            // 接收一个方法作为参数，用来遍历当前在线用户
            "each": [Function],
            // 当前用户
            "me": {
              "id": "11111",
              "info": "Fake user info for socket 111111 on channel presence-demo"
            }
          }
          ```

  - **engine:user_added** 新用户订阅 channel ，处理函数的参数如下：
      - **user** (Object) ： 用户信息，该对象结构如下：

          ```js
          {
            "id": "1111",
            "info": "Fake User Info For UowsMQDGV_kAn3g6AAAi"
          }
          ```

  - **engine:user_removed** 用户离开 channel ，处理函数的参数如下：
      - **user** (Object) ： 用户信息，该对象结构如下：

          ```js
          {
            "id": "1111",
            "info": "private-K2aEIptlMy7lTVGg"
          }
          ```
 */

PresenceChannel = (function(superClass) {
  extend(PresenceChannel, superClass);


  /*
    @nodoc
   */

  function PresenceChannel(name, engine) {
    this.name = name;
    this.engine = engine;
    PresenceChannel.__super__.constructor.call(this, this.name, this.engine);
    this.users = new Users();
  }


  /*
    @nodoc
   */

  PresenceChannel.prototype._authorize = function(callback) {
    return PresenceChannel.__super__._authorize.call(this, (function(_this) {
      return function(err, authResult) {
        try {
          if (!err) {
            _this.users.setMyId(JSON.parse(authResult.channelData).userId);
          }
        } catch (undefined) {}
        return callback(err, authResult);
      };
    })(this));
  };


  /*
    @nodoc
   */

  PresenceChannel.prototype.handleEvent = function(event) {
    var addedUser, removedUser;
    switch (event.name) {
      case 'engine_channel:subscription_succeeded':
        this.subscribed = true;
        this.users.setUsers(event.data);
        return this.trigger('engine:subscription_succeeded', this.users);
      case 'engine_channel:subscription_error':
        this.subscribed = false;
        return this.trigger('engine:subscription_error', event.data);
      case 'engine_channel:user_added':
        addedUser = this.users.addUser(event.data);
        return this.trigger('engine:user_added', addedUser);
      case 'engine_channel:user_removed':
        removedUser = this.users.removeUser(event.data);
        if (removedUser) {
          return this.trigger('engine:user_removed', removedUser);
        }
        break;
      default:
        return PresenceChannel.__super__.handleEvent.call(this, event);
    }
  };


  /*
    @nodoc
   */

  PresenceChannel.prototype.disconnect = function() {
    this.users.reset();
    return PresenceChannel.__super__.disconnect.call(this);
  };

  return PresenceChannel;

})(PrivateChannel);

module.exports = PresenceChannel;



},{"./privateChannel":5,"./users":6}],5:[function(require,module,exports){
'use strict';
var Channel, PrivateChannel, Requester, Utils,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Channel = require('./channel');

Requester = require('../utils/requester');

Utils = require('../utils');


/*
  PrivateChannel 类，在 {Channel} 的基础上提供了用户认证机制
 */

PrivateChannel = (function(superClass) {
  extend(PrivateChannel, superClass);

  function PrivateChannel() {
    return PrivateChannel.__super__.constructor.apply(this, arguments);
  }


  /*
    @nodoc
   */

  PrivateChannel.prototype._authorize = function(callback) {
    return this.engine.authorizer.authorize({}, {
      channelName: this.name
    }, callback);
  };

  return PrivateChannel;

})(Channel);

module.exports = PrivateChannel;



},{"../utils":31,"../utils/requester":33,"./channel":2}],6:[function(require,module,exports){
'use strict';

/*
  @nodoc
 */
var Users;

Users = (function() {
  function Users() {
    this.reset();
  }

  Users.prototype.reset = function() {
    this._users = {};
    this.count = 0;
    this._myId = null;
    return this.me = null;
  };

  Users.prototype._formatUser = function(user) {
    return {
      id: user != null ? user.userId : void 0,
      info: user != null ? user.userInfo : void 0
    };
  };

  Users.prototype.setMyId = function(myId) {
    return this._myId = myId;
  };

  Users.prototype.setUsers = function(users) {
    var i, len, user;
    this._users = {};
    this.count = 0;
    for (i = 0, len = users.length; i < len; i++) {
      user = users[i];
      this._users[user.userId] = this._formatUser(user);
      this.count++;
    }
    return this.me = this.get(this._myId);
  };

  Users.prototype.addUser = function(user) {
    if (!this._users[user.userId]) {
      this.count++;
    }
    this._users[user.userId] = this._formatUser(user);
    return this.get(user.userId);
  };

  Users.prototype.removeUser = function(user) {
    user = this._users[user.userId];
    if (user) {
      delete this._users[user.userId];
      this.count--;
    }
    return user;
  };

  Users.prototype.each = function(fn) {
    var ref, results, user, userId;
    ref = this._users;
    results = [];
    for (userId in ref) {
      user = ref[userId];
      results.push(fn(user));
    }
    return results;
  };

  Users.prototype.get = function(userId) {
    return this._users[userId];
  };

  return Users;

})();

module.exports = Users;



},{}],7:[function(require,module,exports){
'use strict';
var ConfirmAlert, EventAlert, Promise, chatManagerUtil, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:confirmAlert');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');

EventAlert = require('./eventAlert');


/*
  用来处理通知
 */

ConfirmAlert = (function(superClass) {
  extend(ConfirmAlert, superClass);

  function ConfirmAlert() {
    return ConfirmAlert.__super__.constructor.apply(this, arguments);
  }


  /*
    接受该通知
  
    @example 接受该通知（Promise）
      alert.accept().then(function() {
        // 接受成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 接受该通知（回调）
      var onSuccess = function() {
        // 接受成功
      };
  
      var onError = function(err) {
        // 处理 error
      };
  
      alert.accept({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ConfirmAlert.prototype.accept = function(options) {
    var promiseOptions;
    options.alertId = this.alertId;
    options.alertType = (function() {
      switch (this.type) {
        case 'group:joinInvitation:new':
          return 'group:joinInvitation:accepted';
      }
    }).call(this);
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._accept(promiseOptions).then((function(_this) {
      return function() {
        var ref;
        if (!((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0)) {
          return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
        }
        return _this._updateCacheWithStatus('processed');
      };
    })(this)).then(function() {
      return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
    })["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    拒绝该通知
  
    @example 拒绝该通知（Promise）
      alert.reject().then(function() {
        // 拒绝成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 拒绝该通知（回调）
      var onSuccess = function() {
        // 拒绝成功
      };
  
      var onError = function(err) {
        // 处理 error
      };
  
      alert.reject({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ConfirmAlert.prototype.reject = function(options) {
    var promiseOptions;
    options.alertId = this.alertId;
    options.alertType = (function() {
      switch (this.type) {
        case 'group:joinInvitation:new':
          return 'group:joinInvitation:rejected';
      }
    }).call(this);
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._reject(promiseOptions).then((function(_this) {
      return function() {
        var ref;
        if (!((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0)) {
          return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
        }
        return _this._updateCacheWithStatus('processed');
      };
    })(this)).then(function() {
      return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
    })["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    @nodoc
   */

  ConfirmAlert.prototype._accept = function(options) {
    return this.engine.chatManager.request('engine_chat:alert:accept', options);
  };


  /*
    @nodoc
   */

  ConfirmAlert.prototype._reject = function(options) {
    return this.engine.chatManager.request('engine_chat:alert:reject', options);
  };

  return ConfirmAlert;

})(EventAlert);

Promise.toPromise(ConfirmAlert);

module.exports = ConfirmAlert;



},{"../../utils/promise":32,"../chatManagerUtil":10,"./eventAlert":8,"debug":38}],8:[function(require,module,exports){
'use strict';
var EventAlert, Promise, chatManagerUtil, debug;

debug = require('debug')('engine:chat:eventAlert');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');


/*
  通知类

  属性
  --------------------------------------------------------
  - **alertId**  (String) - 通知的唯一标识
  - **from**  (String) - 通知发出者
  - **to**  (String) - 通知接收者
  - **group**  (String) - 群组的 ID ，群组的唯一标识
  - **type**  (String) - 通知类型
  - **status**  (String) - 通知的处理状态，有： **pending** 和 **processed**
  - **lastActiveAt** (String) - 最后更新时间
 */

EventAlert = (function() {

  /*
    @nodoc
   */
  function EventAlert(option, engine) {
    this.engine = engine;
    this.alertId = option.alertId, this.from = option.from, this.to = option.to, this.group = option.group, this.type = option.type, this.status = option.status, this.lastActiveAt = option.lastActiveAt;
  }


  /*
    @nodoc
   */

  EventAlert.prototype._updateCacheWithStatus = function(status) {
    var ref;
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then((function(_this) {
      return function(db) {
        var alert;
        alert = {
          alertId: _this.alertId,
          from: _this.from,
          to: _this.to,
          type: _this.type,
          group: _this.group,
          status: status,
          lastActiveAt: _this.lastActiveAt
        };
        return db.alerts.update(alert);
      };
    })(this)) : void 0;
  };


  /*
    忽略该通知
  
    @example 忽略该通知（Promise）
      alert.ignore().then(function() {
        // 忽略通知成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 忽略该通知（回调）
      var onSuccess = function() {
        // 忽略通知成功
      };
  
      var onError = function(err) {
        // 处理 error
      };
  
      alert.ignore({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  EventAlert.prototype.ignore = function(options) {
    var promiseOptions;
    options.alertId = this.alertId;
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._ignore(promiseOptions).then((function(_this) {
      return function() {
        var ref;
        if (!((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0)) {
          return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
        }
        return _this._updateCacheWithStatus('processed');
      };
    })(this)).then(function() {
      return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
    })["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    @nodoc
   */

  EventAlert.prototype._ignore = function(options) {
    return this.engine.chatManager.request('engine_chat:alert:ignore', options);
  };

  return EventAlert;

})();

Promise.toPromise(EventAlert, null, ['_updateCacheWithStatus']);

module.exports = EventAlert;



},{"../../utils/promise":32,"../chatManagerUtil":10,"debug":38}],9:[function(require,module,exports){
'use strict';
var ChatAlerts, ConfirmAlert, Promise, chatManagerUtil, debug;

debug = require('debug')('engine:chat:alerts');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');

ConfirmAlert = require('./confirmAlert');


/*
  通知管理类
 */

ChatAlerts = (function() {

  /*
    @nodoc
   */
  function ChatAlerts(engine) {
    this.engine = engine;
    void 0;
  }


  /*
    @nodoc
   */

  ChatAlerts.prototype._loadWithCache = function(options) {
    return this.engine.chatManager.dbUtil.getDataAfterMerged('alerts').then(function(data) {
      debug('load alerts with cache', data);
      return data.newestDatas;
    });
  };


  /*
    加载该用户所有未处理过的事件，如果开起了缓存，就会将服务器返回的事件列表存入缓存，否则不做缓存操作。
  
    @example 加载该用户所有未处理过的通知（Promise）
      chatManager.alerts.load().then(function(alerts) {
        // 对返回的通知列表做进一步处理
      }).catch(function(err) {
        // 处理 error
      });;
  
    @example 加载该用户所有未处理过的通知（回调）
      onSuccess = function(alerts) {
        // 对返回的通知列表做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      chatManager.alerts.load({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatAlerts.prototype.load = function(options) {
    var _load, promiseOptions, ref;
    if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
      _load = this._loadWithCache;
    } else {
      _load = this._getAlerts;
    }
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return _load.call(this, promiseOptions).then((function(_this) {
      return function(_alerts) {
        var alert, alerts;
        alerts = (function() {
          var i, len, results;
          results = [];
          for (i = 0, len = _alerts.length; i < len; i++) {
            alert = _alerts[i];
            if (alert.status === 'pending') {
              results.push(new ConfirmAlert(alert, this.engine));
            }
          }
          return results;
        }).call(_this);
        return typeof options.onSuccess === "function" ? options.onSuccess(alerts) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
   @nodoc
   */

  ChatAlerts.prototype.formatEventData = function(eventData) {
    var alert;
    alert = new ConfirmAlert(eventData, this.engine);
    alert._updateCacheWithStatus('pending');
    return alert;
  };


  /*
    @nodoc
   */

  ChatAlerts.prototype._getAlerts = function(options) {
    return this.engine.chatManager.request('engine_chat:alert:get', options);
  };

  return ChatAlerts;

})();

Promise.toPromise(ChatAlerts, null, ['_loadWithCache', 'formatEventData']);

module.exports = ChatAlerts;



},{"../../utils/promise":32,"../chatManagerUtil":10,"./confirmAlert":7,"debug":38}],10:[function(require,module,exports){
'use strict';
var Promise, Protocol;

Promise = require('../utils/promise');

Protocol = require('../protocol');

exports._separateOptionsAndHandlers = function(originalOptions) {
  var handlers, k, options, v;
  options = {};
  handlers = {};
  for (k in originalOptions) {
    v = originalOptions[k];
    if (typeof v === 'function') {
      handlers[k] = v;
    } else {
      options[k] = v;
    }
  }
  return [options, handlers];
};

exports.getPromiseOption = function(options) {
  var handlers, optionsCopy, ref;
  ref = exports._separateOptionsAndHandlers(options), optionsCopy = ref[0], handlers = ref[1];
  return optionsCopy;
};



},{"../protocol":29,"../utils/promise":32}],11:[function(require,module,exports){
'use strict';
var ChatConversation, EventEmitter, ImageUploader, Messages, Promise, VideoUploader, VoiceUploader, chatManagerUtil, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:ChatConversation');

Messages = require('../messages');

chatManagerUtil = require('../chatManagerUtil');

ImageUploader = require('../uploader/imageUploader');

VoiceUploader = require('../uploader/voiceUploader');

VideoUploader = require('../uploader/videoUploader');

EventEmitter = require('../../utils/eventEmitter');

Promise = require('../../utils/promise');


/*
  会话类

  属性
  --------------------------------------------------------
  - **type**  (String) - 会话类型，目前会话类型有： singleChat（私聊）， groupChat（群聊）
  - **target**  (String) - 会话的唯一标识
  - **unreadMessageCount**  (Number) - 未读消息数
  - **lastActiveAt**  (String) - 最后一次更新时间
  - **lastMessage**  (Object) - 最后一条消息
  - **extra** (Object) - 附加信息，用于实现应用自定义业务逻辑，只读。可通过 Open API 进行设置

  事件
  -------------------------------
  - **message:new** 用来监听新消息，处理函数的参数如下：
      - **message** (Object) ： 新消息内容，该消息结构如下：

          ```js
          {
            "messageId": 300,
            // singleChat（单聊）或 groupChat （群聊）
            "type": "singleChat",
            // 来自谁，userId
            "from": "1111",
            // 发给谁，userId 或 groupId
            "to": "1112",
            "content": {
              // 消息类型，type 枚举： text, image, voice, video, location, event
              "type": "text",
              // 消息内容，目前支持的消息内容有： text（文本消息），file（多媒体消息），event（事件消息），location（地理位置消息）
              "text": "Hello World!",
              // 可选，附加信息，用于实现应用自定义业务逻辑
              "extra": {}
            },
            "createdAt": "2015-01-25T07:47:09.678Z"
          }
          ```
 */

ChatConversation = (function(superClass) {
  extend(ChatConversation, superClass);


  /*
    @nodoc
   */

  function ChatConversation(options, engine, isTemporary) {
    var ref;
    if (options == null) {
      options = {};
    }
    this.engine = engine;
    if (isTemporary == null) {
      isTemporary = false;
    }
    this.type = options.type, this.target = options.target, this.unreadMessageCount = options.unreadMessageCount, this.lastActiveAt = options.lastActiveAt, this.lastMessage = options.lastMessage, this.extra = options.extra;
    if (this.unreadMessageCount == null) {
      this.unreadMessageCount = 0;
    }
    if (isTemporary) {
      this.isTemporary = true;
    }
    this.lastActiveAt || (this.lastActiveAt = new Date().toISOString());
    this.messages = new Messages(this.engine);
    if ((ref = this.engine.options.chat) != null ? ref.enableMediaMessage : void 0) {
      this.imageUploader = new ImageUploader(this.engine);
      this.voiceUploader = new VoiceUploader(this.engine);
      this.videoUploader = new VideoUploader(this.engine);
    }
  }


  /*
    获取当前会话消息
  
    @example 获取会话消息（Promise），默认为20条
      conversation.loadMessages().then(function(messages) {
        // 对返回的消息列表做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取会话消息（回调），默认为20条
      onSuccess = function(messages) {
        // 对返回的消息列表做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      conversation.loadMessages({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Number] startMessageId 起始消息的id，可选
    @option options [Number] endMessageId 最后一条消息的id，可选
    @option options [Number] limit 范围，默认为20条，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype.loadMessages = function(options) {
    if (options == null) {
      options = {};
    }
    options.type = this.type;
    options.target = this.target;
    return this.messages.load(options);
  };


  /*
    重置未读消息数
  
    @example 将会话未读消息数重置为 0
      conversation.resetUnread()
    @return [void]
   */

  ChatConversation.prototype.resetUnread = function() {
    this.unreadMessageCount = 0;
    this._resetUnread({
      type: this.type,
      target: this.target
    });
    return this.updateCache();
  };


  /*
    @nodoc
   */

  ChatConversation.prototype.updateCache = function(options) {
    var ref, ref1;
    if (options != null) {
      this.unreadMessageCount = options.unreadMessageCount, this.lastActiveAt = options.lastActiveAt, this.lastMessage = options.lastMessage, this.extra = options.extra;
    }
    if (!((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) || this.isTemporary) {
      return;
    }
    return (ref1 = this.engine.chatManager.dbUtil) != null ? ref1.openDB().then((function(_this) {
      return function(db) {
        var conversation, ref2;
        conversation = {
          type: _this.type,
          target: _this.target,
          unreadMessageCount: _this.unreadMessageCount,
          lastMessage: _this.lastMessage,
          lastActiveAt: _this.lastActiveAt,
          extra: _this.extra
        };
        debug('update conversation cache', conversation);
        return (ref2 = db.conversations) != null ? ref2.update(conversation) : void 0;
      };
    })(this)) : void 0;
  };


  /*
    发送消息
  
    @example 发送消息（Promise）
      conversation.sendMessage({
        type: 'text',
        text: 'Hello World!',
        // 可选，附加信息，用于实现应用自定义业务逻辑
        extra: {}
      }).then(function(messages) {
        // 对返回的数据做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 发送消息（回调）
      onSuccess = function(messages) {
        // 对返回的数据做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      conversation.sendMessage({
        type: 'text',
        text: 'Hello World!',
        // 可选，附加信息，用于实现应用自定义业务逻辑
        extra: {},
        onSuccess: onSuccess,
        onError: onError
      })
  
    @param [Object] options 参数
    @option options [String] type 消息类型，type 取值有： text, image, voice, video, location
    @option options [String] text 文本消息内容，对应的 type 为 text， 可选，仅在文本消息时传递该参数
    @option options [Object] file 多媒体消息内容，对应的 type 为 image, voice, video， 可选，仅在多媒体消息时传递该参数
    @option options [Object] location 地理位置消息内容，对应的 type 为 location， 可选，仅在地理位置消息时传递该参数
    @option options [Object] extra 附加信息，用于实现应用自定义业务逻辑，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
  
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype.sendMessage = function(options) {
    var content, message, ref;
    ref = chatManagerUtil._separateOptionsAndHandlers(options), content = ref[0], message = ref[1];
    message.type = this.type;
    message.to = this.target;
    if (message.content == null) {
      message.content = content;
    }
    return this.messages.send(message);
  };


  /*
    删除会话
  
    @example 删除会话（Promise）
      conversation.delete().then(function() {
        // 删除成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 删除会话（回调）
      onSuccess = function(){
        // 删除成功
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      conversation.delete({
        onSuccess: onSuccess,
        onError: onError
      })
  
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype["delete"] = function(options) {
    return this._deleteConversation({
      type: this.type,
      target: this.target
    }).then((function(_this) {
      return function(result) {
        var ref, ref1;
        _this.engine.chatManager.conversations.removeConversationFromBuffer(_this.target);
        if ((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0) {
          return (ref1 = _this.engine.chatManager.dbUtil) != null ? ref1.openDB().then(function(db) {
            db.conversations.remove(_this.target);
            return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
          }) : void 0;
        } else {
          return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
        }
      };
    })(this));
  };


  /*
    获取 ImageUploader 对象，用于上传图片
  
    @example 获取 ImageUploader （Promise）
      conversation.getImageUploader({
        // 触发文件选择的 DOM 元素的 ID
        browseButton: 'imageMessage',
        // 可选，拖曳区域的 DOM 元素的 ID，可实现拖曳上传
        dropElementId: 'messageContainer',
        // 可选，附加信息，用于实现应用自定义业务逻辑
        extra: {}
      }).then(function(imageUploader) {
        // 可以在 imageUploader 上绑定事件
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取 ImageUploader（回调）
      onSuccess = function(imageUploader) {
        // 可以在 imageUploader 上绑定事件
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      conversation.getImageUploader({
        browseButton: 'imageMessage',
        dropElement: 'messageContainer',
        extra: {},
        onSuccess: onSuccess,
        onError: onError
      })
  
    @param [object] options 初始化 ImageUploader 的参数
    @option options [DOM, String] browseButton 触发选择文件的点选按钮，**必需**，该参数的值可以为一个 DOM 元素的 id,也可是 DOM 元素本身。
    @option options [DOM, String] dropElement
      拖曳上传区域元素的ID，拖曳文件或文件夹后可触发上传，**可选**，，该参数的值可以为一个 DOM 元素的 id,也可是 DOM 元素本身，目前只有 html5 上传方式才支持拖拽上传。
    @option options [Object] extra 附加信息，用于实现应用自定义业务逻辑，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype.getImageUploader = function(options) {
    var ref;
    if (options == null) {
      options = {};
    }
    if (!((ref = this.engine.options.chat) != null ? ref.enableMediaMessage : void 0)) {
      return options.onError('You must set enableMediaMessage');
    }
    if ((options.browseButton == null) || options.browseButton === '') {
      return options.onError('BrowseButton does not exist');
    }
    return this.imageUploader.init({
      browseButton: options.browseButton,
      dropElement: options.dropElement,
      target: this.target,
      type: this.type,
      extra: options.extra
    }).then((function(_this) {
      return function() {
        return typeof options.onSuccess === "function" ? options.onSuccess(_this.imageUploader) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    获取 VoiceUploader 对象，用于上传语音
  
    @example 获取 VoiceUploader （Promise）
      conversation.getVoiceUploader({
        // 可选，附加信息，用于实现应用自定义业务逻辑
        extra: {}
      }).then(function(voiceUploader) {
        // 可以在 voiceUploader 上绑定事件
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取 VoiceUploader（回调）
      onSuccess = function(voiceUploader) {
        // 可以在 voiceUploader 上绑定事件
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      conversation.getVoiceUploader({
        extra: {},
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [object] options 初始化 VoiceUploader 的参数
    @option options [Object] extra 附加信息，用于实现应用自定义业务逻辑，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype.getVoiceUploader = function(options) {
    var ref;
    if (options == null) {
      options = {};
    }
    if (!((ref = this.engine.options.chat) != null ? ref.enableMediaMessage : void 0)) {
      return options.onError('You must set enableMediaMessage');
    }
    return this.voiceUploader.init({
      target: this.target,
      type: this.type,
      extra: options.extra
    }).then((function(_this) {
      return function() {
        return typeof options.onSuccess === "function" ? options.onSuccess(_this.voiceUploader) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    获取 VideoUploader 对象，用于上传视频
  
    @example 获取 VideoUploader （Promise）
      conversation.getVideoUploader({
         // 可选，附加信息，用于实现应用自定义业务逻辑
         extra: {}
      }).then(function(videoUploader) {
        // 可以在 videoUploader 上绑定事件
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取 VideoUploader（回调）
      onSuccess = function(videoUploader) {
        // 可以在 videoUploader 上绑定事件
      };
      onError = function(err) {
        // 处理 error
      };
      conversation.getVideoUploader({
        extra: {},
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [object] options 初始化 VideoUploader 的参数
    @option options [Object] extra 附加信息，用于实现应用自定义业务逻辑，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversation.prototype.getVideoUploader = function(options) {
    var ref;
    if (options == null) {
      options = {};
    }
    if (!((ref = this.engine.options.chat) != null ? ref.enableMediaMessage : void 0)) {
      return options.onError('You must set enableMediaMessage');
    }
    return this.videoUploader.init({
      target: this.target,
      type: this.type,
      extra: options.extra
    }).then((function(_this) {
      return function() {
        return typeof options.onSuccess === "function" ? options.onSuccess(_this.videoUploader) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    @nodoc
   */

  ChatConversation.prototype._deleteConversation = function(options) {
    return this.engine.chatManager.request('engine_chat:conversation:delete', options);
  };


  /*
    @nodoc
   */

  ChatConversation.prototype._resetUnread = function(options) {
    return this.engine.chatManager.request('engine_chat:conversation:resetUnread', options);
  };

  return ChatConversation;

})(EventEmitter);

Promise.toPromise(ChatConversation, null, ['updateCache']);

module.exports = ChatConversation;



},{"../../utils/eventEmitter":30,"../../utils/promise":32,"../chatManagerUtil":10,"../messages":18,"../uploader/imageUploader":20,"../uploader/videoUploader":22,"../uploader/voiceUploader":23,"debug":38}],12:[function(require,module,exports){
'use strict';
var ChatConversations, Conversation, EventEmitter, Promise, chatManagerUtil, debug;

debug = require('debug')('engine:chat:conversations');

Conversation = require('./chatConversation');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');

EventEmitter = require('../../utils/eventEmitter');


/*
  会话管理类
 */

ChatConversations = (function() {

  /*
    @nodoc
   */
  function ChatConversations(engine) {
    this.engine = engine;
    this.initConversationBuffer();
  }


  /*
    @nodoc
   */

  ChatConversations.prototype.initConversationBuffer = function() {
    var conversation, ref, target;
    ref = this._store != null;
    for (target in ref) {
      conversation = ref[target];
      conversation.removeAllListeners();
    }
    return this._store = {};
  };


  /*
    @nodoc
   */

  ChatConversations.prototype.removeConversationFromBuffer = function(target) {
    var ref;
    if ((ref = this._store[target]) != null) {
      ref.removeAllListeners();
    }
    return delete this._store[target];
  };


  /*
    @nodoc
   */

  ChatConversations.prototype._loadWithCache = function(options) {
    return this.engine.chatManager.dbUtil.getDataAfterMerged('conversations').then((function(_this) {
      return function(data) {
        var conversation, i, len, ref, ref1, ref2;
        debug('load conversations with cache', data);
        ref = data.mergedDatas;
        for (i = 0, len = ref.length; i < len; i++) {
          conversation = ref[i];
          if ((ref1 = _this._store[conversation.target]) != null) {
            ref1.isTemporary = false;
          }
          if ((ref2 = _this._store[conversation.target]) != null) {
            ref2.updateCache(conversation);
          }
        }
        return data.newestDatas.filter(function(conversation) {
          return !conversation.isRemoved;
        });
      };
    })(this));
  };


  /*
    @nodoc
   */

  ChatConversations.prototype._loadOneWithoutCache = function(options) {
    var promiseOptions;
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._getConversations(promiseOptions).then(function(conversations) {
      if ((conversations != null ? conversations.length : void 0) > 0) {
        return conversations[0];
      } else {
        return promiseOptions;
      }
    });
  };


  /*
    @nodoc
   */

  ChatConversations.prototype._loadOneWithCache = function(options) {
    var ref;
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then(function(db) {
      return db.conversations.query('target').only(options.target).execute();
    }).then((function(_this) {
      return function(conversations) {
        var newConversation, promiseOptions;
        if (conversations.length > 0) {
          return conversations[0];
        } else {
          newConversation = null;
          promiseOptions = chatManagerUtil.getPromiseOption(options);
          return _this._getConversations(promiseOptions).then(function(newConversations) {
            var conversation;
            if ((newConversations != null ? newConversations.length : void 0) > 0) {
              conversation = newConversations[0];
              conversation.isNew = true;
              return conversation;
            } else {
              conversation = promiseOptions;
              conversation.isTemporary = true;
              return conversation;
            }
          });
        }
      };
    })(this)) : void 0;
  };


  /*
    获取会话列表，如果开起了缓存，就会将服务器返回的会话列表存入缓存，否则不做缓存操作。
  
    @example 获取会话列表（Promise）
      chatManager.conversations.load().then(function(conversations) {
        // 对返回的会话列表做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取会话列表（回调）
      onSuccess = function(conversations) {
        // 对返回的会话列表做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      chatManager.conversations.load({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversations.prototype.load = function(options) {
    var _load, promiseOptions, ref;
    if (options == null) {
      options = {};
    }
    if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
      _load = this._loadWithCache;
    } else {
      _load = this._getConversations;
    }
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return _load.call(this, promiseOptions).then((function(_this) {
      return function(newConversations) {
        var base, conversation, conversations, i, len, name;
        conversations = [];
        for (i = 0, len = newConversations.length; i < len; i++) {
          conversation = newConversations[i];
          if ((base = _this._store)[name = conversation.target] == null) {
            base[name] = new Conversation(conversation, _this.engine);
          }
          conversations.push(_this._store[conversation.target]);
        }
        return typeof options.onSuccess === "function" ? options.onSuccess(conversations) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    获取特定的会话，如果会话不存在，会根据 options 的参数创建一个新的会话返回。
  
    @example 获取特定的会话（promise）
      chatManager.conversations.loadOne({
        type: 'singleChat',
        target: '1111'
      }).then(function(conversation) {
        // 对返回的特定的会话做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取特定的会话（回调）
      onSuccess = function(conversation) {
        // 对返回的特定的会话做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      chatManager.conversations.loadOne({
        type: 'singleChat',
        target: '1111',
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [String] type Conversation 的类型， singleChat（单聊） 或 groupChat （群聊），可选
    @option options [String] target 聊天的对象， userId 或 groupId ，可选
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatConversations.prototype.loadOne = function(options) {
    var _loadOne, promiseOptions, ref;
    if (!options.target) {
      return options.onError('target is required');
    } else if (this._store[options.target] != null) {
      return options.onSuccess(this._store[options.target]);
    } else if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
      _loadOne = this._loadOneWithCache;
    } else {
      _loadOne = this._loadOneWithoutCache;
    }
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return _loadOne != null ? _loadOne.call(this, promiseOptions).then((function(_this) {
      return function(conversation) {
        var base, name;
        if (conversation != null) {
          if ((base = _this._store)[name = conversation.target] == null) {
            base[name] = new Conversation(conversation, _this.engine, conversation.isTemporary);
          }
          if (conversation.isNew) {
            _this._store[conversation.target].updateCache();
          }
          return typeof options.onSuccess === "function" ? options.onSuccess(_this._store[conversation.target]) : void 0;
        } else {
          return options.onSuccess();
        }
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    }) : void 0;
  };


  /*
   @nodoc
   */

  ChatConversations.prototype.handleEvent = function(event) {
    var conversation, ref, ref1;
    debug('Conversation handleEvent dispatcher', event);
    switch (event.name) {
      case 'message:new':
        conversation = event.data.type === 'singleChat' ? this._store[event.data.from] : this._store[event.data.to];
        if (!conversation) {
          return;
        }
        conversation.lastMessage = event.data;
        conversation.unreadMessageCount++;
        conversation.lastActiveAt = event.data.createdAt;
        conversation.updateCache();
        if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
          return (ref1 = this.engine.chatManager.dbUtil) != null ? ref1.openDB().then(function(db) {
            var message;
            message = event.data;
            message.id = message.from + message.to + message.messageId;
            message.target = conversation.target;
            return db.messages.update(message).then(function() {
              return conversation.trigger(event.name, event.data);
            });
          }) : void 0;
        } else {
          return conversation.trigger(event.name, event.data);
        }
    }
  };


  /*
   @nodoc
   */

  ChatConversations.prototype._getConversations = function(options) {
    return this.engine.chatManager.request('engine_chat:conversation:get', options);
  };

  return ChatConversations;

})();

Promise.toPromise(ChatConversations, ['load', 'loadOne', '_getConversations']);

module.exports = ChatConversations;



},{"../../utils/eventEmitter":30,"../../utils/promise":32,"../chatManagerUtil":10,"./chatConversation":11,"debug":38}],13:[function(require,module,exports){
'use strict';
var DbUtil, Promise, dbVersion, debug, loadJS, schema;

debug = require('debug')('engine:chat:dbUtil');

loadJS = require('../utils/requester/loadJS');

Promise = require('../utils/promise');

schema = {
  conversations: {
    key: {
      keyPath: 'target'
    },
    indexes: {
      lastActiveAt: {},
      target: {}
    }
  },
  messages: {
    key: {
      keyPath: 'id'
    },
    indexes: {
      messageId: {},
      createdAt: {},
      from: {},
      to: {},
      type: {},
      target: {}
    }
  },
  groups: {
    key: {
      keyPath: 'groupId'
    },
    indexes: {
      lastActiveAt: {},
      groupId: {},
      isRemoved: {}
    }
  },
  alerts: {
    key: {
      keyPath: 'alertId'
    },
    indexes: {
      lastActiveAt: {},
      from: {},
      group: {},
      alertId: {},
      status: {},
      to: {},
      type: {}
    }
  },
  tmpMessages: {
    key: {
      keyPath: 'id',
      autoIncrement: true
    },
    indexes: {
      messageId: {},
      createdAt: {},
      from: {},
      to: {},
      type: {},
      target: {}
    }
  }
};

dbVersion = 2;


/*
  @nodoc
 */

DbUtil = (function() {
  function DbUtil(engine) {
    this.engine = engine;
    void 0;
  }

  DbUtil.prototype.handelDbException = function(message, err) {
    var ref, ref1;
    console.warn(message);
    if ((ref = this.server) != null) {
      if (typeof ref.close === "function") {
        ref.close();
      }
    }
    this.server = null;
    if (err != null) {
      debug(err);
    }
    return (ref1 = this.engine.options.chat) != null ? ref1.enableCache = false : void 0;
  };

  DbUtil.prototype.initLocalDB = function() {
    return this.openDB()["catch"]((function(_this) {
      return function(err) {
        _this.handelDbException('Your browser does not support local storage', err);
        return Promise.resolve();
      };
    })(this));
  };

  DbUtil.prototype.openDB = function() {
    var name, ref, ref1, self;
    if (!((ref = this.engine.options.chat) != null ? ref.enableCache : void 0)) {
      return Promise.reject('You must set enableCache');
    }
    name = this.engine.chatManager.user.userId;
    if (!name) {
      return Promise.reject('You must login firstly.');
    }
    if (("chatManagerDB-" + name) === this.dbName) {
      if (this.server) {
        return Promise.resolve(this.server);
      }
    } else {
      if ((ref1 = this.server) != null) {
        ref1.close();
      }
    }
    debug('Switch db', this.dbName + (" -> chatManagerDB-" + name));
    this.dbName = "chatManagerDB-" + name;
    self = this;
    return new Promise(function(resolve, reject) {
      return loadJS.require('enableCache', self.engine.options.basePath).then(function() {
        return db.open({
          server: self.dbName,
          version: dbVersion,
          schema: schema
        });
      }).then(function(s) {
        if (s['conversations'] == null) {
          self.handelDbException('Can not open db, you can try again after cleaned cache');
          return reject();
        } else {
          self.server = s;
          return resolve(s);
        }
      })["catch"](function(err) {
        self.handelDbException('Your browser does not support local storage', err);
        return reject(err);
      });
    });
  };

  DbUtil.prototype.clearCache = function() {
    var ref, ref1, ref2, ref3, ref4, ref5, ref6;
    if (!(((ref = this.engine) != null ? (ref1 = ref.options.chat) != null ? ref1.enableCache : void 0 : void 0) && this.server)) {
      return;
    }
    debug('clean cache', this.dbName);
    if ((ref2 = this.server.messages) != null) {
      ref2.clear();
    }
    if ((ref3 = this.server.conversations) != null) {
      ref3.clear();
    }
    if ((ref4 = this.server.groups) != null) {
      ref4.clear();
    }
    if ((ref5 = this.server.alerts) != null) {
      ref5.clear();
    }
    if ((ref6 = this.server) != null) {
      if (typeof ref6.close === "function") {
        ref6.close();
      }
    }
    this.server = null;
    return typeof indexedDB !== "undefined" && indexedDB !== null ? indexedDB.deleteDatabase(this.dbName) : void 0;
  };

  DbUtil.prototype.getRemoteData = function(schema, options) {
    var dataSource, needSendAck;
    if (options == null) {
      options = {};
    }
    dataSource = {
      conversations: 'engine_chat:conversation:get',
      alerts: 'engine_chat:alert:get',
      groups: 'engine_chat:group:get',
      messages: 'engine_chat:message:get'
    };
    if (!dataSource[schema]) {
      return Promise.resolve([]);
    }
    if (schema === 'message') {
      needSendAck = true;
    }
    return new Promise((function(_this) {
      return function(resolve, reject) {
        options.onSuccess = function(result) {
          if (schema === 'messages') {
            result.id = result.from + result.to + result.messageId;
          }
          return resolve(result);
        };
        options.onError = function(err) {
          return reject(err);
        };
        return _this.engine.chatManager.request(dataSource[schema], options, needSendAck);
      };
    })(this));
  };

  DbUtil.prototype.match = function(options) {
    return function(data) {
      var k, v;
      for (k in options) {
        v = options[k];
        if (k === 'lastActiveAt') {
          continue;
        }
        if ((data[k] != null) && data[k] !== v) {
          return false;
        }
      }
      return true;
    };
  };

  DbUtil.prototype.getDataAfterMerged = function(schema, options) {
    var scope;
    if (options == null) {
      options = {};
    }
    scope = {};
    return this.openDB().then((function(_this) {
      return function(server) {
        scope.db = server;
        return scope.db[schema].query('lastActiveAt').filter(_this.match(options)).desc().execute();
      };
    })(this)).then((function(_this) {
      return function(data) {
        var ref;
        if (data == null) {
          data = [];
        }
        scope.data = data;
        if (((ref = data[0]) != null ? ref.lastActiveAt : void 0) != null) {
          options.lastActiveAt = data[0].lastActiveAt;
        }
        return _this.getRemoteData(schema, options);
      };
    })(this)).then(function(remoteDatas) {
      var i, len, promises, remoteData;
      if (remoteDatas == null) {
        remoteDatas = [];
      }
      scope.remoteDatas = remoteDatas;
      promises = [];
      for (i = 0, len = remoteDatas.length; i < len; i++) {
        remoteData = remoteDatas[i];
        promises.push(scope.db[schema].update(remoteData));
      }
      return Promise.all(promises);
    }).then((function(_this) {
      return function() {
        return scope.db[schema].query('lastActiveAt').filter(_this.match(options)).desc().execute();
      };
    })(this)).then(function(newestDatas) {
      if (newestDatas == null) {
        newestDatas = [];
      }
      return {
        newestDatas: newestDatas,
        mergedDatas: scope.remoteDatas
      };
    });
  };

  return DbUtil;

})();

module.exports = DbUtil;



},{"../utils/promise":32,"../utils/requester/loadJS":35,"debug":38}],14:[function(require,module,exports){
'use strict';
var ChatGroup, Promise, Users, chatManagerUtil, debug;

debug = require('debug')('engine:chat:group');

Users = require('../users');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');


/*
  群组类

  属性
  --------------------------------------------------------

  - **groupId**  (String) - 群组的唯一表示
  - **isPublic**  (Boolean) - 是否公开
  - **userCanInvite**  (Boolean) - 除创建者（owner）外，其他群用户是否可以发送加群邀请
  - **owner** (String) - 群创建者
  - **userCount**  (Number) - 当前群组用户数
  - **userCountLimit**  (Number) - 群用户数上限
  - **isRemoved**  (Boolean) - 是否被删除了
  - **lastActiveAt**  (String) - 最后更新时间
 */

ChatGroup = (function() {

  /*
    @nodoc
   */
  function ChatGroup(options, engine) {
    this.engine = engine;
    this.groupId = options.groupId, this.owner = options.owner, this.isPublic = options.isPublic, this.userCanInvite = options.userCanInvite, this.userCount = options.userCount, this.userCountLimit = options.userCountLimit, this.isRemoved = options.isRemoved;
    this.lastActiveAt = options.lastActiveAt;
    this.users = new Users(this.engine);
  }


  /*
    获取群组成员列表
  
    @example 获取群组成员列表（Promise）
      group.loadUsers().then(function(users) {
        // 对返回的群组成员列表做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取群组成员列表（回调）
      onSuccess = function(users) {
        // 对返回的群组成员列表做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      group.loadUsers({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroup.prototype.loadUsers = function(options) {
    options.groupId = this.groupId;
    return this.users.loadGroupUsers(options);
  };


  /*
    邀请用户加入群组
  
    @example 邀请用户加入群组（Promise）
      group.inviteUsers({
        userIds: ['1111']
      }).then(function() {
        // 邀请成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 邀请用户加入群组（回调）
      onSuccess = function() {
        // 邀请成功
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      group.inviteUsers({
        userIds: ['1111'],
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Array<String>] userIds 一组用户的 id
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroup.prototype.inviteUsers = function(options) {
    options.groupId = this.groupId;
    return this._inviteUsers(options);
  };


  /*
    从群组中移出成员
  
    @example 从群组中移出成员（Promise）
      group.removeUsers({
        userIds: ['1111']
      }).then(function(users) {
        // 移除某用户成功
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 从群组中移出成员（回调）
      onSuccess = function(users) {
        // 移除某用户成功
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      group.removeUsers({
        userIds: ['1111'],
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Array<String>] userIds 一组用户的 id
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroup.prototype.removeUsers = function(options) {
    options.groupId = this.groupId;
    return this._removeUsers(options);
  };


  /*
    离开群组
  
    @example 离开群组（Promise）
      group.leave().then(function() {
        // 成功离开群组
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 离开群组（回调）
      onSuccess = function() {
        // 成功离开群组
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      group.leave({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroup.prototype.leave = function(options) {
    var promiseOptions;
    if (options == null) {
      options = {};
    }
    options.groupId = this.groupId;
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._leaveGroup(promiseOptions).then((function(_this) {
      return function() {
        var ref, ref1;
        _this.engine.chatManager.conversations.removeConversationFromBuffer(_this.groupId);
        if ((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0) {
          return (ref1 = _this.engine.chatManager.dbUtil) != null ? ref1.openDB().then(function(db) {
            return Promise.all([db.conversations.remove(_this.groupId), db.groups.remove(_this.groupId)]);
          }).then(function() {
            return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
          })["catch"](function() {
            return typeof options.Error === "function" ? options.Error() : void 0;
          }) : void 0;
        } else {
          return typeof options.onSuccess === "function" ? options.onSuccess() : void 0;
        }
      };
    })(this))["catch"](function(err) {
      return typeof options.Error === "function" ? options.Error(err) : void 0;
    });
  };


  /*
    @nodoc
   */

  ChatGroup.prototype._inviteUsers = function(options) {
    return this.engine.chatManager.request('engine_chat:group:joinInvitation:send', options);
  };


  /*
    @nodoc
   */

  ChatGroup.prototype._removeUsers = function(options) {
    return this.engine.chatManager.request('engine_chat:group:removeUsers', options);
  };


  /*
    @nodoc
   */

  ChatGroup.prototype._leaveGroup = function(options) {
    return this.engine.chatManager.request('engine_chat:group:leave', options);
  };

  return ChatGroup;

})();

Promise.toPromise(ChatGroup, null, ['updateCache']);

module.exports = ChatGroup;



},{"../../utils/promise":32,"../chatManagerUtil":10,"../users":24,"debug":38}],15:[function(require,module,exports){
'use strict';
var ChatGroups, Group, Promise, chatManagerUtil, debug;

debug = require('debug')('engine:chat:groups');

chatManagerUtil = require('../chatManagerUtil');

Group = require('./chatGroup');

Promise = require('../../utils/promise');


/*
  群组管理类
 */

ChatGroups = (function() {

  /*
    @nodoc
   */
  function ChatGroups(engine) {
    this.engine = engine;
    void 0;
  }


  /*
    @nodoc
   */

  ChatGroups.prototype._loadWithCache = function(options) {
    var scope;
    scope = {};
    return this.engine.chatManager.dbUtil.getDataAfterMerged('groups', options).then((function(_this) {
      return function(data) {
        var ref;
        debug('load groups with cache', data);
        scope.data = data;
        return (ref = _this.engine.chatManager.dbUtil) != null ? ref.openDB() : void 0;
      };
    })(this)).then(function(db) {
      var group, groups, i, len, ref;
      groups = scope.data.newestDatas;
      ref = groups.slice(1);
      for (i = 0, len = ref.length; i < len; i++) {
        group = ref[i];
        if (group.isRemoved) {
          db.groups.remove(group.groupId);
        }
      }
      return groups.filter(function(group) {
        return !group.isRemoved;
      });
    });
  };


  /*
    获取群组列表
  
    @example 获取群组列表（Promise）
      chatManager.groups.load().then(function(groups) {
        // 对返回的群组列表做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取群组列表（回调）
      onSuccess = function(groups) {
        // 对返回的群组列表做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      chatManager.groups.load({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroups.prototype.load = function(options) {
    var _load, promiseOptions, ref;
    if (options == null) {
      options = {};
    }
    if (!((ref = this.engine.options.chat) != null ? ref.enableCache : void 0)) {
      _load = this._getGroups;
    } else {
      _load = this._loadWithCache;
    }
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return _load.call(this, promiseOptions).then((function(_this) {
      return function(_groups) {
        var group, gruops;
        gruops = (function() {
          var i, len, results;
          results = [];
          for (i = 0, len = _groups.length; i < len; i++) {
            group = _groups[i];
            results.push(new Group(group, this.engine));
          }
          return results;
        }).call(_this);
        return typeof options.onSuccess === "function" ? options.onSuccess(gruops) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    创建一个群组
  
    @example 获取一个群组（Promise）
      chatManager.groups.create({
        isPublic: true,
        userCanInvite: true,
        inviteUserIds: ['1111']
      }).then(function(result) {
        // 对返回的数据做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取一个群组（回调）
      onSuccess = function(result) {
        // 对返回的数据做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      chatManager.groups.create({
        isPublic: true,
        userCanInvite: true,
        inviteUserIds: ['1111'],
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [Boolean] isPublic 群组是否公开，默认为 true
    @option options [Boolean] userCanInvite 除创建者（owner）外，其他群用户是否可以发送加群邀请，默认为 true
    @option options [Array<String>] inviteUserIds 被邀请加入群聊的一组用户的 ID
    @option options [Function] onSuccess 成功后回调的函數，可选
    @option options [Function] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  ChatGroups.prototype.create = function(options) {
    var promiseOptions;
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    return this._createGroup(promiseOptions).then((function(_this) {
      return function(group) {
        return _this._getGroups({
          groupId: group.groupId
        });
      };
    })(this)).then((function(_this) {
      return function(groups) {
        var groupsObjs, ref, ref1;
        if ((typeof grups !== "undefined" && grups !== null ? grups.length : void 0) < 0) {
          throw new Error('create group failed');
        }
        if ((ref = _this.engine.options.chat) != null ? ref.enableCache : void 0) {
          if ((ref1 = _this.engine.chatManager.dbUtil) != null) {
            ref1.openDB().then(function(db) {
              var ref2;
              return (ref2 = db.groups) != null ? ref2.update(groups[0]) : void 0;
            });
          }
        }
        groupsObjs = new Group(groups[0]);
        return typeof options.onSuccess === "function" ? options.onSuccess(groupsObjs) : void 0;
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };


  /*
    @nodoc
   */

  ChatGroups.prototype._getGroups = function(options) {
    return this.engine.chatManager.request('engine_chat:group:get', options);
  };


  /*
    @nodoc
   */

  ChatGroups.prototype._createGroup = function(options) {
    return this.engine.chatManager.request('engine_chat:group:create', options);
  };

  return ChatGroups;

})();

Promise.toPromise(ChatGroups, null, ['_loadWithCache']);

module.exports = ChatGroups;



},{"../../utils/promise":32,"../chatManagerUtil":10,"./chatGroup":14,"debug":38}],16:[function(require,module,exports){
'use strict';
var LocationHelper, Promise, debug, locationHelper;

Promise = require('../../utils/promise');

debug = require('debug')('engine:chat:locationHelper');


/*
  地理位置管理类


  浏览器兼容
  --------------------------------------------------
  - **IE** (>= 9)
  - **Chrome** (>= 31)
  - **Firefox** (>= 38)
  - **Safari** (>= 7.1)
 */

LocationHelper = (function() {
  function LocationHelper() {}


  /*
    获取地理位置，调用该方法时，需要向浏览器请求相应的权限，推送宝会适时的向浏览器发送该请求，只有用户同意之后才能正常发送消息。
  
    @example 获取地理位置（promise）
      engine.chatManager.locationHelper.getLocation().then(function(location) {
        // 对返回的地理位置信息做进一步处理
      }).catch(function(err) {
        // 处理 error
      });
  
    @example 获取地理位置（回调）
      onSuccess = function(location) {
        // 对返回的地理位置信息做进一步处理
      };
  
      onError = function(err) {
        // 处理 error
      };
  
      engine.chatManager.locationHelper.getLocation({
        onSuccess: onSuccess,
        onError: onError
      });
  
    @param [Object] options 参数
    @option options [String] onSuccess 成功后回调的函數，可选
    @option options [String] onError 失败后回调的函數，可选
    @return [void, Promise] 如果 options 中含有 onSuccess 或者 onError 则无返回值，否则返回 Promise
   */

  LocationHelper.prototype.getLocation = function(options) {
    var config, onError, onSuccess;
    if (!(typeof navigator !== "undefined" && navigator !== null ? navigator.geolocation : void 0)) {
      return options.onError('Geolocation is not supported by this browser.');
    }
    onSuccess = function(result) {
      var position;
      position = {
        lat: result.coords.latitude,
        lng: result.coords.longitude
      };
      return options.onSuccess(position);
    };
    onError = function(err) {
      return options.onError(err);
    };
    config = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 30000
    };
    return navigator.geolocation.getCurrentPosition(onSuccess, onError, config);
  };

  return LocationHelper;

})();

Promise.toPromise(LocationHelper, ['getLocation']);

locationHelper = new LocationHelper();

module.exports = locationHelper;



},{"../../utils/promise":32,"debug":38}],17:[function(require,module,exports){
'use strict';
var Alerts, ChatManager, Conversations, DbUtil, EventEmitter, Groups, LocationHelper, Promise, Protocol, chatManagerUtil, debug, loadJS,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:chatManager');

Protocol = require('../protocol');

Conversations = require('./conversations');

Groups = require('./groups');

Alerts = require('./alerts');

Promise = require('../utils/promise');

chatManagerUtil = require('./chatManagerUtil');

DbUtil = require('./dbUtil');

LocationHelper = require('./helpers/locationHelper');

loadJS = require('../utils/requester/loadJS');

EventEmitter = require('../utils/eventEmitter');


/*
  Chat 管理类，用户可以通过 engine.chatManager 获得

  属性
  --------------------------------------------------------
  - **state** [String] - 当前用户及登录状态，枚举值： initialized, loggingIn, loggedIn, failed, loggedOut
  - **conversations**  ([ChatConversations](./ChatConversations.html)) - 会话管理对象
  - **groups**  ([ChatGroups](./ChatGroups.html)) - 群组管理对象
  - **alerts** ([Alerts](./ChatAlerts.html)) - 事件管理对象
  - **locationHelper** ([LocationHelper](./LocationHelper.html)) - 地理位置管理对象

  事件
  -------------------------------
  - **message:new** 用来监听新消息，处理函数的参数如下：
      - **message** (Object) ： 获得的新消息，该消息结构如下：

          ```js
          {
            "messageId": 300,
            // singleChat（单聊）或 groupChat （群聊）
            "type": "singleChat",
            // 来自谁，userId
            "from": "1111",
            // 发给谁，userId 或 groupId
            "to": "1112",
            "content": {
              // 消息类型，type 枚举： text, image, voice, video, location, event
              "type": "text",
              // 消息内容，目前支持的消息内容有： text（文本消息），file（多媒体消息），event（事件消息），location（地理位置消息）
              "text": "Hello World!",
              // 可选，附加信息，用于实现应用自定义业务逻辑
              "extra": {}
            },
            "createdAt": "2015-01-25T07:47:09.678Z"
          }
          ```

  - **user:presenceChanged** 用户在线状态发生变化，处理函数的参数如下：
      - **presence** (Object) ： 状态和用户信息，该对象结构如下：

          ```js
          {
              "userId": "1111",
              // 变为哪个状态，online 或 offline
              "changedTo": "online"
          }
          ```
 */

ChatManager = (function(superClass) {
  extend(ChatManager, superClass);


  /*
    @nodoc
    构造函数.
    @param [Engine] @engine Engine 的实例
   */

  function ChatManager(engine) {
    var ref;
    this.engine = engine;
    this.request = bind(this.request, this);
    this._handleOptions = bind(this._handleOptions, this);
    this._handleOptions();
    this._loginOptions = null;
    this.user = null;
    this.state = 'initialized';
    this.noConnectionOperations = [];
    this.conversations = new Conversations(this.engine);
    this.groups = new Groups(this.engine);
    this.alerts = new Alerts(this.engine);
    this.locationHelper = LocationHelper;
    this.supportOffline = ((ref = this.engine.options) != null ? ref.supportOffline : void 0) || false;
  }


  /*
   @nodoc
   */

  ChatManager.prototype._handleOptions = function() {
    var k, promiseBlock, ref, ref1, v;
    debug('handle options', this.engine.options);
    if (!((ref = this.engine.options) != null ? ref.chat : void 0)) {
      return;
    }
    promiseBlock = [];
    if (!(this.engine.options.chat && (typeof window !== "undefined" && window !== null))) {
      return;
    }
    ref1 = this.engine.options.chat;
    for (k in ref1) {
      v = ref1[k];
      if (this.engine.options.chat[k]) {
        promiseBlock.push(loadJS.require(k, this.engine.options.basePath));
      }
    }
    return Promise.all(promiseBlock).then(function(result) {
      debug('load extension over', result);
      return result;
    });
  };


  /*
    用户登录的方法，调用该方法后，engine 可以监听一系列的 chat 相关的事件，并实时的推送消息给用户
  
    @example 登录
      var onLoginSucceeded = function() {
        console.log('login succeeded');
      };
  
      var onLoginError = function(err) {
        console.log('login failed：', err);
      };
  
      var chatUserId = 'chatUserId';
      engine.chatManager.login({
        authData: chatUserId
      });
  
      engine.chatManager.bind('login:succeeded：', onLoginSucceeded);
      engine.chatManager.bind('login:failed：', onLoginError);
  
    @param [object] options 登录参数
    @option options [String] authData chatUserId
   */

  ChatManager.prototype.login = function(options) {
    var ref;
    if (options == null) {
      options = {};
    }
    this.state = 'loggingIn';
    this._loginOptions = options;
    if (this.engine.connection.state !== 'connected') {
      return;
    }
    if (!options.authData) {
      options.authData = (ref = this.engine.options) != null ? ref.authData : void 0;
    }
    return this.engine.authorizer.authorize(options, {
      chatLogin: true
    }, (function(_this) {
      return function(err, authResult) {
        var preUser;
        if (err) {
          _this.state = 'failed';
          return _this.trigger('login:failed', err);
        }
        preUser = _this.user;
        try {
          _this.user = JSON.parse(authResult.userData);
        } catch (undefined) {}
        return _this.engine.connection.sendEvent('engine_chat:user:login', authResult, function(err, result) {
          var k, ref1, ref2, v;
          if (err) {
            if (err.code === Protocol.responseErrors.noConnection) {
              return;
            }
            debug('login error', err);
            _this.state = 'failed';
            return _this.trigger('login:failed', err);
          }
          for (k in result) {
            v = result[k];
            _this.user[k] = v;
          }
          _this.state = 'loggedIn';
          if ((preUser != null ? preUser.userId : void 0) === ((ref1 = _this.user) != null ? ref1.userId : void 0)) {
            _this.handleNoConnectionOperations();
          } else if (preUser != null) {
            _this.handleNoConnectionOperations(true);
          }
          if ((ref2 = _this.engine.options.chat) != null ? ref2.enableCache : void 0) {
            if (_this.dbUtil == null) {
              _this.dbUtil = new DbUtil(_this.engine);
            }
            _this.dbUtil.initLocalDB().then(function() {
              return _this.trigger('login:succeeded', result);
            });
          } else {
            _this.trigger('login:succeeded');
          }
          return debug('login succeeded', result);
        });
      };
    })(this));
  };


  /*
   @nodoc
   */

  ChatManager.prototype.autoLogin = function() {
    if (this._loginOptions) {
      return this.login(this._loginOptions);
    }
  };


  /*
    用户退出的方法，调用该方法后会解除监听
  
    @example 注销用户
      engine.chatManager.logout().then(function(result) {
        console.log(result);
      }).catch(function(err) {
        console.log(err);
      });
   */

  ChatManager.prototype.logout = function(options) {
    var callback, handlers, ref;
    this._loginOptions = null;
    ref = chatManagerUtil._separateOptionsAndHandlers(options), options = ref[0], handlers = ref[1];
    return callback = this.engine.connection.sendEvent('engine_chat:user:logout', (function(_this) {
      return function(err) {
        if (err) {
          if (err.code === Protocol.responseErrors.noConnection.code) {
            _this.bufferNoConnectionOperations('engine_chat:user:logout', null, callback);
            _this.state = 'loggedOut';
            return typeof handlers.onSuccess === "function" ? handlers.onSuccess() : void 0;
          } else {
            debug('logout error', err);
            return typeof handlers.onError === "function" ? handlers.onError(err) : void 0;
          }
        } else {
          _this.handleNoConnectionOperations(true);
          _this.state = 'loggedOut';
          _this.conversations.initConversationBuffer();
          _this.user = null;
          debug('logout succeeded');
          return typeof handlers.onSuccess === "function" ? handlers.onSuccess() : void 0;
        }
      };
    })(this));
  };


  /*
   @nodoc
   */

  ChatManager.prototype.handleEvent = function(event) {
    var eventName;
    eventName = event.name.replace('engine_chat:', '');
    event.name = eventName;
    event.data = this.formatEventData(event);
    this.trigger(eventName, event.data);
    switch (event.name) {
      case 'message:new':
        this.conversations.handleEvent(event);
        return this.engine.connection.sendResponseEvent(event.id);
      case 'alert:new':
        return this.engine.connection.sendResponseEvent(event.id);
    }
  };


  /*
    @nodoc
   */

  ChatManager.prototype.formatEventData = function(event) {
    if (event.name === 'alert:new') {
      return this.alerts.formatEventData(event.data);
    } else {
      return event.data;
    }
  };


  /*
    @nodoc
   */

  ChatManager.prototype.bufferNoConnectionOperations = function(name, data, callback) {
    var noConnectionOperation, ref;
    if (callback && ((ref = this.user) != null ? ref.userId : void 0)) {
      if (this.noConnectionOperations == null) {
        this.noConnectionOperations = [];
      }
      noConnectionOperation = {
        name: name,
        data: data,
        callback: callback
      };
      debug('buffer no connection operations', noConnectionOperation);
      if (name !== 'engine_chat:message:send') {
        noConnectionOperation.timer = setTimeout(function() {
          var err;
          err = Protocol.responseErrors.requestTimeout;
          err.isFailed = true;
          callback(err);
          return noConnectionOperation.isTimeout = true;
        }, 60 * 1000);
      }
      return this.noConnectionOperations.push(noConnectionOperation);
    }
  };


  /*
    @nodoc
   */

  ChatManager.prototype.handleNoConnectionOperations = function(isFailed) {
    var err, operation, ref;
    if (((ref = this.noConnectionOperations) != null ? ref.length : void 0) < 1 && this.handlingNoConnectionOperations && !isFailed) {
      return;
    }
    this.handlingNoConnectionOperations = true;
    while ((operation = this.noConnectionOperations.shift())) {
      if (operation.isTimeout) {
        continue;
      }
      if (operation.timer != null) {
        clearTimeout(operation.timer);
      }
      if (isFailed) {
        err = Protocol.responseErrors.noConnection;
        err.isFailed = true;
        operation.callback(err);
      } else {
        this.engine.connection.sendEvent(operation.name, operation.data, operation.callback);
      }
    }
    return this.handlingNoConnectionOperations = false;
  };


  /*
    开启本地缓存时，调用该方法可以清除本地缓存
  
    @example 清除本地缓存
      engine.chatManager.clearCache()
   */

  ChatManager.prototype.clearCache = function() {
    var ref, ref1;
    if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
      return (ref1 = this.dbUtil) != null ? ref1.clearCache() : void 0;
    }
  };


  /*
    @nodoc
   */

  ChatManager.prototype.request = function(eventName, options, needSendAck) {
    var callback, handlers, ref;
    ref = chatManagerUtil._separateOptionsAndHandlers(options), options = ref[0], handlers = ref[1];
    if (this.state !== 'loggedIn') {
      return typeof handlers.onError === "function" ? handlers.onError(Protocol.responseErrors.unauthorized) : void 0;
    }
    callback = (function(_this) {
      return function(err, result) {
        var ref1;
        if (err) {
          if (err.code === Protocol.responseErrors.noConnection.code && !err.isFailed && _this.supportOffline) {
            if ((eventName.indexOf('get')) !== -1 && ((ref1 = _this.engine.options.chat) != null ? ref1.enableCache : void 0)) {
              return handlers.onSuccess([]);
            }
            return _this.bufferNoConnectionOperations(eventName, options, callback);
          } else {
            return typeof handlers.onError === "function" ? handlers.onError(err) : void 0;
          }
        } else {
          return typeof handlers.onSuccess === "function" ? handlers.onSuccess(result) : void 0;
        }
      };
    })(this);
    if (needSendAck) {
      callback.needSendAck = true;
    }
    return this.engine.connection.sendEvent(eventName, options, callback);
  };


  /*
    @nodoc
    Only support chrome
    There is currently no way of enumerating the existing databases in the standard
    So it can not use indexedDB.deleteDatabase(dbname) delete all database
    see http://stackoverflow.com/questions/15234363/indexeddb-view-all-databases-and-object-stores
   */

  ChatManager.prototype.clearAllCache = function() {
    debug('clean all cache');
    return typeof indexedDB !== "undefined" && indexedDB !== null ? typeof indexedDB.webkitGetDatabaseNames === "function" ? indexedDB.webkitGetDatabaseNames().onsuccess = function(sender, args) {
      var i, len, name, ref, results;
      ref = sender.target.result;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        debug('clean cache', name);
        if (name.indexOf('chatManagerDB' > 0)) {
          results.push(typeof indexedDB !== "undefined" && indexedDB !== null ? indexedDB.deleteDatabase(name) : void 0);
        } else {
          results.push(void 0);
        }
      }
      return results;
    } : void 0 : void 0;
  };

  return ChatManager;

})(EventEmitter);

Promise.toPromise(ChatManager, ['logout']);

module.exports = ChatManager;



},{"../protocol":29,"../utils/eventEmitter":30,"../utils/promise":32,"../utils/requester/loadJS":35,"./alerts":9,"./chatManagerUtil":10,"./conversations":12,"./dbUtil":13,"./groups":15,"./helpers/locationHelper":16,"debug":38}],18:[function(require,module,exports){
'use strict';
var ChatMessages, Promise, TmpChatMessage, chatManagerUtil, debug;

debug = require('debug')('engine:chat:messages');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');

TmpChatMessage = require('./tmpMessage');


/*
  @nodoc
 */

ChatMessages = (function() {
  function ChatMessages(engine) {
    this.engine = engine;
    void 0;
  }

  ChatMessages.prototype._loadNewestMessages = function(options) {
    var limit, ref, scope;
    debug('load newest messages', options);
    limit = options.limit || 20;
    scope = {};
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then((function(_this) {
      return function(server) {
        scope.db = server;
        return scope.db.messages.query('messageId').filter(_this.engine.chatManager.dbUtil.match({
          target: options.target,
          type: options.type
        })).desc().execute();
      };
    })(this)).then((function(_this) {
      return function(messagesResult) {
        var endMessageId, ref1;
        if (messagesResult == null) {
          messagesResult = [];
        }
        debug('get last local message', messagesResult[0]);
        endMessageId = ((ref1 = messagesResult[0]) != null ? ref1.messageId : void 0) + 1 || 0;
        scope.messagesResult = messagesResult;
        return _this._getMessages({
          type: options.type,
          target: options.target,
          endMessageId: endMessageId
        });
      };
    })(this)).then((function(_this) {
      return function(newMessages) {
        var j, len, message, messagesResult, promises;
        debug('get newest messages', newMessages);
        for (j = 0, len = newMessages.length; j < len; j++) {
          message = newMessages[j];
          message.isNew = true;
        }
        messagesResult = newMessages.concat(scope.messagesResult);
        promises = _this._loadMissingMessageBlocksPromises(messagesResult, options);
        return Promise.all(promises).then(function(missingMessageBlocks) {
          var k, l, len1, len2, missingMessages;
          debug('missing messages blocks:', missingMessageBlocks);
          for (k = 0, len1 = missingMessageBlocks.length; k < len1; k++) {
            missingMessages = missingMessageBlocks[k];
            if (missingMessages != null) {
              for (l = 0, len2 = missingMessages.length; l < len2; l++) {
                message = missingMessages[l];
                message.isNew = true;
                messagesResult.push(message);
              }
            }
          }
          return messagesResult.slice(0, +limit + 1 || 9e9);
        });
      };
    })(this)) : void 0;
  };

  ChatMessages.prototype._loadMissingMessageBlocksPromises = function(messagesResult, options) {
    var i, promises;
    promises = [];
    if (messagesResult.length === 0) {
      promises.push(this._getMessages({
        type: options.type,
        target: options.target,
        startMessageId: options.startMessageId,
        endMessageId: options.endMessageId,
        limit: options.limit || 20
      }));
      return promises;
    }
    if (options.startMessageId > messagesResult[0].messageId) {
      promises.push(this._getMessages({
        type: options.type,
        target: options.target,
        startMessageId: options.startMessageId,
        endMessageId: messagesResult[0].messageId + 1,
        limit: options.startMessageId - messagesResult[0].messageId
      }));
    }
    if (options.endMessageId < messagesResult[messagesResult.length - 1].messageId) {
      promises.push(this._getMessages({
        type: options.type,
        target: options.target,
        startMessageId: messagesResult[messagesResult.length - 1].messageId - 1,
        endMessageId: options.endMessageId,
        limit: messagesResult[messagesResult.length - 1].messageId - options.endMessageId
      }));
    }
    i = 0;
    while (i < messagesResult.length - 1) {
      (function(_this) {
        return (function(messagesResult) {
          if (messagesResult[i].messageId - messagesResult[i + 1].messageId !== 1) {
            return promises.push(_this._getMessages({
              type: options.type,
              target: options.target,
              startMessageId: messagesResult[i].messageId - 1,
              endMessageId: messagesResult[i + 1].messageId + 1,
              limit: messagesResult[i].messageId - messagesResult[i + 1].messageId
            }));
          }
        });
      })(this)(messagesResult);
      i++;
    }
    return promises;
  };

  ChatMessages.prototype._save = function(messages, target) {
    var ref;
    if (!(messages instanceof Array)) {
      messages.isNew = true;
      messages = [messages];
    }
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then(function(db) {
      var j, len, message, updateMessagePromises;
      updateMessagePromises = [];
      for (j = 0, len = messages.length; j < len; j++) {
        message = messages[j];
        if (!message.isNew) {
          continue;
        }
        message.target = target;
        message.id = message.from + message.to + message.messageId;
        updateMessagePromises.push(db.messages.update(message));
      }
      return Promise.all(updateMessagePromises);
    }) : void 0;
  };

  ChatMessages.prototype._loadWithCache = function(options) {
    var limit, ref;
    if (!((options.startMessageId != null) && (options.endMessageId != null))) {
      return this._loadNewestMessages(options);
    }
    limit = options.limit || 20;
    if (!options.startMessageId) {
      options.startMessageId = options.endMessageId + limit;
    }
    if (!options.endMessageId) {
      options.endMessageId = options.startMessageId - limit;
    }
    debug('load with cache', options);
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then((function(_this) {
      return function(db) {
        return db.messages.query('messageId').bound(options.endMessageId, options.startMessageId).filter(_this.engine.chatManager.dbUtil.match({
          target: options.target,
          type: options.type
        })).desc().execute();
      };
    })(this)).then((function(_this) {
      return function(messagesResult) {
        var promises;
        debug('local load', messagesResult);
        limit = options.startMessageId - options.endMessageId + 1;
        if (messagesResult.length === limit) {
          return Promise.resolve(messagesResult);
        } else {
          promises = _this._loadMissingMessageBlocksPromises(messagesResult, options);
          return Promise.all(promises).then(function(missingMessageBlocks) {
            var j, k, len, len1, message, missingMessages;
            debug('missing messages blocks:', missingMessageBlocks);
            for (j = 0, len = missingMessageBlocks.length; j < len; j++) {
              missingMessages = missingMessageBlocks[j];
              if (missingMessages != null) {
                for (k = 0, len1 = missingMessages.length; k < len1; k++) {
                  message = missingMessages[k];
                  message.isNew = true;
                  messagesResult.push(message);
                }
              }
            }
            return messagesResult;
          });
        }
      };
    })(this)) : void 0;
  };

  ChatMessages.prototype.load = function(options) {
    var _load, limit, promiseOptions, ref;
    if ((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) {
      _load = this._loadWithCache;
    } else {
      _load = this._getMessages;
    }
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    if (promiseOptions.to == null) {
      promiseOptions.to = promiseOptions.target;
    }
    limit = options.limit || 20;
    return _load.call(this, promiseOptions).then((function(_this) {
      return function(messages) {
        var ref1;
        if ((ref1 = _this.engine.options.chat) != null ? ref1.enableCache : void 0) {
          return _this._save(messages, promiseOptions.target).then(function() {
            var ref2;
            return (ref2 = _this.engine.chatManager.dbUtil) != null ? ref2.openDB() : void 0;
          }).then(function(db) {
            if (_this.engine.options.supportOffline) {
              return db.tmpMessages.query('messageId').filter(_this.engine.chatManager.dbUtil.match({
                target: options.target,
                type: options.type
              })).desc().execute();
            } else {
              return Promise.resolve([]);
            }
          }).then(function(msgs) {
            var j, k, len, len1, message, msg, tmpMessage;
            debug('tmp messages', msgs);
            for (j = 0, len = msgs.length; j < len; j++) {
              msg = msgs[j];
              tmpMessage = new TmpChatMessage(_this.engine, msg);
              if (tmpMessage.state === 'sending') {
                tmpMessage.retrySendMessage();
              }
              messages.push(tmpMessage);
            }
            messages.sort(function(message1, message2) {
              var n;
              n = message2.messageId - message1.messageId;
              if (n === 0) {
                return (message2 != null ? message2.id : void 0) - (message1 != null ? message1.id : void 0);
              } else {
                return n;
              }
            });
            for (k = 0, len1 = messages.length; k < len1; k++) {
              message = messages[k];
              if (message.state == null) {
                message.state = 'succeed';
              }
            }
            return typeof options.onSuccess === "function" ? options.onSuccess(messages.slice(0, +limit + 1 || 9e9)) : void 0;
          });
        } else {
          return typeof options.onSuccess === "function" ? options.onSuccess(messages.slice(0, +limit + 1 || 9e9)) : void 0;
        }
      };
    })(this))["catch"](function(err) {
      return typeof options.onError === "function" ? options.onError(err) : void 0;
    });
  };

  ChatMessages.prototype.send = function(options) {
    var message, promise, promiseOptions, ref, tmpMessage;
    promiseOptions = chatManagerUtil.getPromiseOption(options);
    message = promiseOptions;
    message.from = this.engine.chatManager.user.userId;
    promise = void 0;
    if (((ref = this.engine.options.chat) != null ? ref.enableCache : void 0) && this.engine.options.supportOffline) {
      tmpMessage = new TmpChatMessage(this.engine, message);
      promise = tmpMessage.save().then((function(_this) {
        return function() {
          return _this._sendMessage(promiseOptions);
        };
      })(this));
    } else {
      promise = this._sendMessage(promiseOptions);
    }
    return promise.then((function(_this) {
      return function(sentMessage) {
        var ref1, ref2;
        message.messageId = sentMessage.messageId;
        message.id = message.from + message.to + sentMessage.messageId;
        if (sentMessage.content != null) {
          message.content = sentMessage.content;
        } else {
          message.content = options.content;
        }
        if ((ref1 = _this.engine.options.chat) != null ? ref1.enableCache : void 0) {
          return (ref2 = _this.engine.chatManager.dbUtil) != null ? ref2.openDB().then(function(db) {
            if (_this.engine.options.supportOffline) {
              return tmpMessage.remove().then(function() {
                debug('removed tmpMessage', tmpMessage.id);
                message.target = options.to;
                db.messages.update(message);
                return typeof options.onSuccess === "function" ? options.onSuccess(message) : void 0;
              });
            } else {
              message.target = options.to;
              db.messages.update(message);
              return typeof options.onSuccess === "function" ? options.onSuccess(message) : void 0;
            }
          }) : void 0;
        } else {
          return typeof options.onSuccess === "function" ? options.onSuccess(message) : void 0;
        }
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        var ref1, ref2;
        if (((ref1 = _this.engine.options.chat) != null ? ref1.enableCache : void 0) && _this.engine.options.supportOffline) {
          tmpMessage.changState('failed');
          return (ref2 = _this.engine.chatManager.dbUtil) != null ? ref2.openDB().then(function(db) {
            return db.tmpMessages.update(tmpMessage.toJSON());
          }).then(function() {
            return options != null ? typeof options.onError === "function" ? options.onError(err) : void 0 : void 0;
          }) : void 0;
        } else {
          return options != null ? typeof options.onError === "function" ? options.onError(err) : void 0 : void 0;
        }
      };
    })(this));
  };

  ChatMessages.prototype._sendMessage = function(options) {
    return this.engine.chatManager.request('engine_chat:message:send', options);
  };

  ChatMessages.prototype._getMessages = function(options) {
    return this.engine.chatManager.request('engine_chat:message:get', options, true);
  };

  return ChatMessages;

})();

Promise.toPromise(ChatMessages, ['send', 'load', '_getMessages', '_sendMessage']);

module.exports = ChatMessages;



},{"../../utils/promise":32,"../chatManagerUtil":10,"./tmpMessage":19,"debug":38}],19:[function(require,module,exports){
'use strict';
var EventEmitter, TmpChatMessage,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

EventEmitter = require('../../utils/eventEmitter');


/*
  @nodoc
 */

TmpChatMessage = (function(superClass) {
  extend(TmpChatMessage, superClass);

  function TmpChatMessage(engine, options) {
    this.engine = engine;
    if (options == null) {
      options = {};
    }
    this.changState = bind(this.changState, this);
    this.messageId = options.messageId, this.createdAt = options.createdAt, this.from = options.from, this.to = options.to, this.type = options.type, this.content = options.content, this.state = options.state, this.target = options.target, this.id = options.id;
    if (this.state == null) {
      this.state = 'sending';
    }
    if (this.target == null) {
      this.target = this.to;
    }
  }

  TmpChatMessage.prototype.save = function() {
    var ref;
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then((function(_this) {
      return function(db) {
        if (_this.messageId != null) {
          return db.tmpMessages.add(_this.toJSON());
        } else {
          return db.messages.query('messageId').filter(_this.engine.chatManager.dbUtil.match({
            target: _this.target,
            type: _this.type
          })).desc().execute().then(function(messagesResult) {
            var ref1;
            if (messagesResult == null) {
              messagesResult = [];
            }
            _this.messageId = ((ref1 = messagesResult[0]) != null ? ref1.messageId : void 0) || 0;
            return db.tmpMessages.add(_this.toJSON());
          });
        }
      };
    })(this)).then((function(_this) {
      return function(tmpMessage) {
        _this.id = tmpMessage[0].id;
        return _this.toJSON();
      };
    })(this)) : void 0;
  };

  TmpChatMessage.prototype.changState = function(state) {
    var previous, ref, stateInfo;
    if ('string' !== typeof state) {
      return;
    }
    ref = [this.state, state], previous = ref[0], this.state = ref[1];
    stateInfo = {
      previous: previous,
      current: this.state
    };
    return this.trigger('state:changed', stateInfo);
  };

  TmpChatMessage.prototype.toJSON = function() {
    var that;
    that = {
      messageId: this.messageId,
      createdAt: this.createdAt,
      from: this.from,
      to: this.to,
      type: this.type,
      state: this.state,
      content: this.content,
      target: this.target
    };
    if (this.id) {
      that.id = this.id;
    }
    return that;
  };

  TmpChatMessage.prototype.remove = function() {
    var ref;
    if (!this.id) {
      return;
    }
    return (ref = this.engine.chatManager.dbUtil) != null ? ref.openDB().then((function(_this) {
      return function(db) {
        return db.tmpMessages.remove(_this.id);
      };
    })(this)) : void 0;
  };

  TmpChatMessage.prototype.retrySendMessage = function() {
    if (this.state === 'succeeded') {
      return;
    }
    return this.remove().then((function(_this) {
      return function() {
        var Messages, messages;
        Messages = require('../messages');
        messages = new Messages(_this.engine);
        return messages.send({
          target: _this.to,
          type: _this.type,
          content: _this.content,
          from: _this.from,
          to: _this.to
        });
      };
    })(this)).then((function(_this) {
      return function(message) {
        _this.messageId = message.messageId;
        _this.changState('succeeded');
        return _this.toJSON();
      };
    })(this))["catch"]((function(_this) {
      return function() {
        return _this.changState('failed');
      };
    })(this));
  };

  return TmpChatMessage;

})(EventEmitter);

module.exports = TmpChatMessage;



},{"../../utils/eventEmitter":30,"../messages":18}],20:[function(require,module,exports){
'use strict';
var ChatImageUploader, ChatUploader, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:ChatImageUploader');

ChatUploader = require('./uploader');


/*
  用于实现图片上传
 */

ChatImageUploader = (function(superClass) {
  extend(ChatImageUploader, superClass);

  function ChatImageUploader(engine) {
    this.engine = engine;
    ChatImageUploader.__super__.constructor.call(this, this.engine);
  }


  /*
    @nodoc
    初始化图片上传
   */

  ChatImageUploader.prototype.init = function(options) {
    options.messageType = 'image';
    return ChatImageUploader.__super__.init.call(this, options);
  };

  return ChatImageUploader;

})(ChatUploader);

module.exports = ChatImageUploader;



},{"./uploader":21,"debug":38}],21:[function(require,module,exports){
'use strict';
var ChatUploader, EventEmitter, Messages, Promise, debug, loadJS,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:ChatUploader');

EventEmitter = require('../../utils/eventEmitter');

Messages = require('../messages');

loadJS = require('../../utils/requester/loadJS');

Promise = require('../../utils/promise');


/*
  用于实现上传

  属性
  --------------------------------------------------------
  - **state**  (String) - 状态，枚举值如下：
      - `initialized` ： 初始化完成
      - `uploading` ： 正在上传
      - `uploaded` ： 上传成功
      - `failed` ： 初始化失败

  事件
  -------------------------------
  - **upload:done** 某个文件上传完毕，处理函数的参数如下：
      - **file** (Object)： 上传后七牛返回的文件信息，该对象结构如下：

          ```js
          {
            "id": "o_19rkanrppgc1t2hua01vvdbcvg",
            "lastModifiedDate": "8/1/2015, 5:50:58 PM",
            "loaded": 30764,
            "name": "audio_19rkanrpb9391bbl1llo1gm71782e",
            "origSize": 30764,
            "percent": 100,
            "size": 30764,
            "status": 5,
            "type": "audio/wav"
          }
          ```

      - **info** (String) ： 七牛返回的文件信息
  - **upload:error** 某个文件上传失败，处理函数的参数如下：
      - **error** (Object) ： error 信息
  - **message:sending** 上传完毕后开始发送信息，处理函数的参数如下：
      - **message** (Object) ： 上传成功后的消息，该对象结构如下：

          ```js
          {
            "content": {
              "type": "image",
              "file": {
                "key": "key",
                "name": "fname",
                "size": "fsize",
                "etag": "etag",
                "mimeType": "mimeType",
                // 宽，仅限于图片、视频消息
                "width": 1200,
                // 高，仅限于图片、视频消息
                "height": 960,
                // 时长，仅限于语音、视频消息
                "duration": 1.2
              }
            },
            "type": "groupChat",
            "to": "target",
            "from": "111111"
          }
          ```

  - **message:sent** 上传完毕后消息发送成功，处理函数的参数如下：
      - **message** (Object) ： 成功发送的消息，该对象结构如下：

          ```js
          {
            "content": {
              "url": "download url"
              "etag": "FrXCQeUTuAzn89hOXGN3fNMVM_6d",
              "mimeType": "image/jpeg",
              "name": "3088587_165616966601_2.jpg",
              "size": "126400",
              // 宽，仅限于图片、视频消息
              "width": 1200,
              // 高，仅限于图片、视频消息
              "height": 960,
              // 时长，仅限于语音、视频消息
              "duration": 1.2,
              // 缩略图 url，图片宽度小于等于 100px
              "thumbUrl": "
            },
            "createdAt": "2015-08-01T09:54:59.647Z",
            "from": "1111",
            "fromMe": true,
            "id": "asd55bae0e70e08198162ccd96e32",
            "messageId": 32,
            "state": "sent",
            "to": "55bae0e70e08198162ccd96e",
            "type": "groupChat"
          }
          ```

  - **message:sendFailed** 上传完毕后消息发送失败，处理函数的参数如下：
      - **error** (Object) ： error 信息

  - **state:changed** 状态发生变化，处理函数的参数如下：
      - **stateInfo** (Object) ： 状态信息，该对象结构如下：

          ```js
          {
            "previous": "oldState",
            "current": "newState"
          }
          ```

  - **failed** 初始化上传组件失败，处理函数的参数如下：
      - **error** (Object) ： error 信息
 */

ChatUploader = (function(superClass) {
  extend(ChatUploader, superClass);


  /*
    @nodoc
   */

  function ChatUploader(engine) {
    this.engine = engine;
    this._requestPermission = bind(this._requestPermission, this);
    this._changstate = bind(this._changstate, this);
    this.init = bind(this.init, this);
    this._uploader = {};
    this.state = 'initialized';
    this.messages = new Messages(this.engine);
  }


  /*
    @nodoc
    初始化 ChatUploader
   */

  ChatUploader.prototype.init = function(options) {
    var button, errMsg, ref, self;
    debug('uploader init', options);
    if (!((ref = this.engine.options.chat) != null ? ref.enableMediaMessage : void 0)) {
      errMsg = 'if you want use getVideoUploader you must enableMediaMessage';
      this._changstate('failed');
      this.trigger('failed', errMsg);
      return Promise.reject(errMsg);
    }
    self = this;
    if (options.browseButton != null) {
      button = options.browseButton;
    } else {
      button = typeof document !== "undefined" && document !== null ? document.createElement('input') : void 0;
    }
    return loadJS.require('enableMediaMessage', this.engine.options.basePath).then(function() {
      self._uploader = Qiniu.uploader({
        runtimes: 'html5,flash,html4',
        browse_button: button,
        uptoken: self.engine.chatManager.user.uploadToken,
        domain: 'domain',
        chunk_size: '4mb',
        dragdrop: true,
        drop_element: options.dropElement,
        max_file_size: '100mb',
        save_key: true,
        auto_start: true,
        x_vars: {
          'targetId': options.target
        },
        init: {
          'FileUploaded': function(uploader, file, info) {
            var message;
            debug('file uploaded, wait to send', info);
            self.trigger('upload:done', file, info);
            info = JSON.parse(info);
            message = {
              content: {
                type: options.messageType,
                file: {
                  key: info.key,
                  name: info.fname,
                  size: info.fsize,
                  etag: info.etag,
                  mimeType: info.mimeType
                }
              },
              type: options.type,
              to: options.target,
              from: self.engine.chatManager.user.userId
            };
            switch (options.messageType) {
              case 'image':
                message.content.file.width = info.imageInfo.width;
                message.content.file.height = info.imageInfo.height;
                break;
              case 'voice':
                message.content.file.duration = info.avinfo.audio.duration;
                break;
              case 'video':
                message.content.file.width = info.avinfo.video.width;
                message.content.file.height = info.avinfo.video.height;
                message.content.file.duration = info.avinfo.video.duration || info.avinfo.format.duration;
            }
            self.trigger('message:sending', message);
            if (options.extra) {
              message.extra = options.extra;
            }
            return self.messages.send(message).then(function(sentMessage) {
              sentMessage.createdAt = new Date().toISOString();
              sentMessage.state = 'sent';
              return self.trigger('message:sent', sentMessage);
            })["catch"](function(err) {
              debug('send message failed', err);
              return self.trigger('message:sendFailed', err);
            });
          },
          'Error': function(uploader, err, errTip) {
            debug('init uploader failed', err, errTip);
            return self.trigger('upload:error', err, errTip);
          }
        }
      });
      return self._uploader.bind('StateChanged', function(uploader) {
        switch (uploader.state) {
          case 1:
            return self._changstate('uploaded');
          case 2:
            return self._changstate('uploading');
        }
      });
    })["catch"](function(err) {
      debug('Init uploader failed', err);
      self._changstate('failed');
      return self.trigger('failed', err);
    });
  };


  /*
    @nodoc
   */

  ChatUploader.prototype._changstate = function(state) {
    var previous, ref, stateInfo;
    if ('string' !== typeof state) {
      return;
    }
    ref = [this.state, state], previous = ref[0], this.state = ref[1];
    stateInfo = {
      previous: previous,
      current: this.state
    };
    debug('state changed', stateInfo);
    return this.trigger('state:changed', stateInfo);
  };


  /*
    @nodoc
    Destroy ChatUploader and remove chatUploader all eventlistener.
   */

  ChatUploader.prototype.destroy = function() {
    var ref, ref1, ref2;
    if ((ref = this.mediaConstraints) != null ? ref.video : void 0) {
      if ((ref1 = this.stream) != null) {
        ref1.stop();
      }
      this.recordRTC = null;
    }
    if ((ref2 = this._uploader) != null) {
      ref2.destroy();
    }
    return this.unbind();
  };


  /*
    @nodoc
   */

  ChatUploader.prototype._requestPermission = function(config, onMediaSuccessHandlerName, onMediaSuccessHandlerOptions) {
    var e, error, onMediaError, onMediaSuccess;
    if (!this.mediaConstraints) {
      return;
    }
    this._changstate('initializing');
    onMediaSuccess = (function(_this) {
      return function(stream) {
        _this._changstate('initialized');
        _this.stream = stream;
        _this.recordRTC = RecordRTC(stream, config);
        if (_this[onMediaSuccessHandlerName] != null) {
          return _this[onMediaSuccessHandlerName](onMediaSuccessHandlerOptions);
        }
      };
    })(this);
    onMediaError = (function(_this) {
      return function(err) {
        _this._changstate('failed');
        _this.trigger('failed', err);
        return console.warn('Can not open media!!!', err);
      };
    })(this);
    try {
      return navigator.getUserMedia(this.mediaConstraints, onMediaSuccess, onMediaError);
    } catch (error) {
      e = error;
      return this._onMediaError('Your browser does not support getUserMedia');
    }
  };

  return ChatUploader;

})(EventEmitter);

module.exports = ChatUploader;



},{"../../utils/eventEmitter":30,"../../utils/promise":32,"../../utils/requester/loadJS":35,"../messages":18,"debug":38}],22:[function(require,module,exports){
'use strict';
var ChatUploader, ChatVideoUploader, debug,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:ChatVideoUploader');

ChatUploader = require('./uploader');


/*
  用于实现视频上传

  浏览器兼容
  -------------------------------
  - **Chrome** (所有版本) 注：所录制视频不包含声音
  - **Firefox** (>= 29)

  属性
  --------------------------------------------------------
  - **state**  (String) - 状态，除继承自 {ChatUploader} 的枚举值以外，增加了以下枚举值：
      - `recording` ： 正在录制
      - `recorded` ： 录制成功

  事件

  除继承自 {ChatUploader} 的事件以外，增加了以下事件：

  -------------------------------
  - **record:started** 开始录制视频
      - 无参数
  - **record:stopped** 停止录制，处理函数的参数如下：
      - **videoURL** (String) ： 视频文件的 URL
      - **duration** (Number) ： 视频文件的时长
 */

ChatVideoUploader = (function(superClass) {
  extend(ChatVideoUploader, superClass);


  /*
    @nodoc
   */

  function ChatVideoUploader(engine) {
    this.engine = engine;
    this.getRealTimeData = bind(this.getRealTimeData, this);
    this.send = bind(this.send, this);
    this._stopHandler = bind(this._stopHandler, this);
    this.stopRecord = bind(this.stopRecord, this);
    this.startRecord = bind(this.startRecord, this);
    this.requestPermission = bind(this.requestPermission, this);
    ChatVideoUploader.__super__.constructor.call(this, this.engine);
    this.mediaConstraints = {
      video: true
    };
    this.isChrome = typeof navigator.webkitGetUserMedia !== 'undefined';
    if (!this.isChrome) {
      this.mediaConstraints.audio = true;
    }
  }


  /*
    向浏览器请求权限，Engine 在初始化时会自动调用一次。若需要在此请求权限，调用此方法。
  
    @example 向浏览器请求录音权限
      videoUploader.requestPermission()
   */

  ChatVideoUploader.prototype.requestPermission = function(onMediaSuccessHandlerName, onMediaSuccessHandlerOptions) {
    var config;
    config = {
      disableLogs: true,
      type: 'video',
      video: {
        width: 320,
        height: 240
      },
      canvas: {
        width: 320,
        height: 240
      }
    };
    if (!this.isChrome) {
      config = {
        disableLogs: true
      };
    }
    return this._requestPermission(config, onMediaSuccessHandlerName, onMediaSuccessHandlerOptions);
  };


  /*
    @nodoc
    初始化视频上传
   */

  ChatVideoUploader.prototype.init = function(options) {
    options.messageType = 'video';
    return ChatVideoUploader.__super__.init.call(this, options);
  };


  /*
    开始录制视频
  
    @note 视频上传最大60秒，超出时间后会自动停止。
    @param [Sting] video DOM 节点，用于录制时显示实时画面
  
    @example 开始录制视频
      video = document.getElementById("#video");
      videoUploader.startRecord(video)
   */

  ChatVideoUploader.prototype.startRecord = function(video) {
    var ref, videoURL;
    if ((ref = this.state) === 'recording' || ref === 'uploading') {
      return;
    }
    if (!this.recordRTC) {
      return this.requestPermission('startRecord', video);
    }
    this._changstate('recording');
    this.trigger('record:started');
    this.recordRTC.blob = null;
    this.duration = null;
    this.recordRTC.startRecording();
    videoURL = URL.createObjectURL(this.stream);
    video.src = videoURL;
    video.autoplay = true;
    this.startTime = new Date().getTime();
    return this.recordTimer = setTimeout((function(_this) {
      return function() {
        return _this.stopRecord();
      };
    })(this), 60 * 1000);
  };


  /*
    结束视频录制
  
    @example 结束视频录制
      videoUploader.stopRecord()
   */

  ChatVideoUploader.prototype.stopRecord = function() {
    if (this.state !== 'recording') {
      return console.warn('You have to perform when you record.');
    }
    if (!this.recordRTC) {
      return this.requestPermission('stopRecord');
    }
    if (this.recordTimer != null) {
      clearTimeout(this.recordTimer);
    }
    return this.recordRTC.stopRecording((function(_this) {
      return function(videoURL) {
        _this._changstate('recorded');
        _this.tmpVideoURL = videoURL;
        return _this._stopHandler(videoURL);
      };
    })(this));
  };


  /*
    @nodoc
   */

  ChatVideoUploader.prototype._stopHandler = function(videoURL) {
    if (!this.duration) {
      this.duration = new Date().getTime() - this.startTime;
    }
    return this.trigger('record:stop', videoURL, this.duration);
  };


  /*
    停止录制并发送
  
    @example 停止录制并发送
      videoUploader.send()
      videoUploader.bind('message:sent', function(message) {
        console.log('视频消息发送成功');
      });
   */

  ChatVideoUploader.prototype.send = function() {
    if (this.state === 'uploading') {
      return console.warn('Please wait for the upload.');
    }
    if (!this.recordRTC) {
      return this.requestPermission();
    }
    if (this.recordTimer != null) {
      clearTimeout(this.recordTimer);
    }
    if (this.state === 'recorded') {
      this._uploader.addFile(this.recordRTC.getBlob());
      this._stopHandler(this.tmpVideoURL);
      return;
    }
    return this.recordRTC.stopRecording((function(_this) {
      return function(videoURL) {
        var recordedBlob;
        recordedBlob = _this.recordRTC.getBlob();
        if (recordedBlob != null) {
          _this._uploader.addFile(recordedBlob);
        }
        return _this._stopHandler(videoURL);
      };
    })(this));
  };


  /*
    获取未播放时显示的画面
  
    @example 获取未播放时显示的画面
      video = document.getElementById("#video");
      videoUploader.getRealTimeData(video)
   */

  ChatVideoUploader.prototype.getRealTimeData = function(video) {
    var videoURL;
    if (this.state === 'recording') {
      return console.warn('You must stop recording.');
    }
    if (!this.recordRTC) {
      return this.requestPermission('getRealTimeData', video);
    }
    this.recordRTC.startRecording();
    videoURL = URL.createObjectURL(this.stream);
    video.src = videoURL;
    return video.autoplay = true;
  };

  return ChatVideoUploader;

})(ChatUploader);

module.exports = ChatVideoUploader;



},{"./uploader":21,"debug":38}],23:[function(require,module,exports){
'use strict';
var ChatUploader, ChatVoiceUploader, debug,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:chat:ChatVoiceUploader');

ChatUploader = require('./uploader');


/*
  用于实现语音上传

  浏览器兼容
  -------------------------------
  - **Chrome** (所有版本)
  - **Firefox** (>= 29)

  属性
  --------------------------------------------------------
  - **state**  (String) - 状态，除继承自 {ChatUploader} 的枚举值以外，增加了以下枚举值：
      - `recording` ： 正在录制
      - `recorded` ： 录制成功

  事件

  除继承自 {ChatUploader} 的事件以外，增加了以下事件：

  -------------------------------
  - **record:started** 开始录制语音
      - 无参数
  - **record:stopped** 停止录制，处理函数的参数如下：
      - **blob** (Object) ： 存储了语音信息的 blob 对象
      - **duration** (Number) ： 视频文件的时长
 */

ChatVoiceUploader = (function(superClass) {
  extend(ChatVoiceUploader, superClass);


  /*
    @nodoc
   */

  function ChatVoiceUploader(engine) {
    this.engine = engine;
    this.send = bind(this.send, this);
    this._stopHandler = bind(this._stopHandler, this);
    this.stopRecord = bind(this.stopRecord, this);
    this.startRecord = bind(this.startRecord, this);
    this.requestPermission = bind(this.requestPermission, this);
    ChatVoiceUploader.__super__.constructor.call(this, this.engine);
    this.mediaConstraints = {
      audio: true
    };
    this.isChrome = typeof navigator.webkitGetUserMedia !== 'undefined';
  }


  /*
    向浏览器请求录音权限， Engine 在初始化时会自动调用一次。若需要在此请求权限，调用此方法。
  
    @example 向浏览器请求录音权限
      voiceUploader.requestPermission()
   */

  ChatVoiceUploader.prototype.requestPermission = function(onMediaSuccessHandlerName, onMediaSuccessHandlerOptions) {
    var config;
    config = {
      disableLogs: true
    };
    if (this.isChrome) {
      config.compression = 8;
    }
    return this._requestPermission(config, onMediaSuccessHandlerName, onMediaSuccessHandlerOptions);
  };


  /*
    @nodoc
    初始化语音上传
   */

  ChatVoiceUploader.prototype.init = function(options) {
    options.messageType = 'voice';
    return ChatVoiceUploader.__super__.init.call(this, options);
  };


  /*
    开始录音
  
    @note 语音上传最大60秒，超出时间后会自动停止。
  
    @example 开始录音
      voiceUploader.startRecord()
   */

  ChatVoiceUploader.prototype.startRecord = function() {
    var ref;
    if ((ref = this.state) === 'recording' || ref === 'uploading') {
      return;
    }
    if (!this.recordRTC) {
      return this.requestPermission('startRecord');
    }
    this._changstate('recording');
    this.trigger('record:started');
    this.recordRTC.blob = null;
    this.duration = null;
    this.recordRTC.startRecording();
    this.startTime = new Date().getTime();
    return this.recordTimer = setTimeout((function(_this) {
      return function() {
        return _this.stopRecord();
      };
    })(this), 60 * 1000);
  };


  /*
    结束录音
  
    @example 结束录音
      voiceUploader.stopRecord()
   */

  ChatVoiceUploader.prototype.stopRecord = function() {
    if (this.state !== 'recording') {
      return console.warn('You have to perform when you record.');
    }
    if (!this.recordRTC) {
      return this.requestPermission('stopRecord');
    }
    return this.recordRTC.stopRecording((function(_this) {
      return function(audioURL) {
        _this._changstate('recorded');
        return _this._stopHandler();
      };
    })(this));
  };


  /*
    @nodoc
   */

  ChatVoiceUploader.prototype._stopHandler = function() {
    if (this.recordTimer != null) {
      clearTimeout(this.recordTimer);
    }
    if (!this.duration) {
      this.duration = new Date().getTime() - this.startTime;
    }
    return this.trigger('record:stopped', this.recordRTC.getBlob(), this.duration);
  };


  /*
    停止录音并发送
  
    @example 停止录音并发送
      voiceUploader.send()
      voiceUploader.bind('message:sent', function(message) {
        console.log('语音消息发送成功');
      });
   */

  ChatVoiceUploader.prototype.send = function() {
    if (this.state === 'uploading') {
      return console.warn('Please wait for the upload.');
    }
    if (!this.recordRTC) {
      return this.requestPermission();
    }
    return this.recordRTC.stopRecording((function(_this) {
      return function(audioURL) {
        var recordedBlob;
        recordedBlob = _this.recordRTC.getBlob();
        if (recordedBlob != null) {
          _this._uploader.addFile(recordedBlob);
        }
        return _this._stopHandler();
      };
    })(this));
  };

  return ChatVoiceUploader;

})(ChatUploader);

module.exports = ChatVoiceUploader;



},{"./uploader":21,"debug":38}],24:[function(require,module,exports){
'use strict';
var Promise, Users, chatManagerUtil, debug;

debug = require('debug')('engine:chat:users');

chatManagerUtil = require('../chatManagerUtil');

Promise = require('../../utils/promise');


/*
  @nodoc
 */

Users = (function() {
  function Users(engine) {
    this.engine = engine;
    void 0;
  }

  Users.prototype.loadGroupUsers = function(options) {
    return this._getGroupUsers(options);
  };

  Users.prototype._getGroupUsers = function(options) {
    return this.engine.chatManager.request('engine_chat:group:getUsers', options);
  };

  return Users;

})();

Promise.toPromise(Users);

module.exports = Users;



},{"../../utils/promise":32,"../chatManagerUtil":10,"debug":38}],25:[function(require,module,exports){
(function (process){
'use strict';
var Connection, EventEmitter, Protocol, ServerAddrManager, Utils, debug, eio,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:connection');

eio = require('engine.io-client');

EventEmitter = require('../utils/eventEmitter');

ServerAddrManager = require('./serverAddrManager');

Utils = require('../utils');

Protocol = require('../protocol');


/*
  Connection 类

  属性
  --------------------------------------------------------
  - **state**  (String) - 状态，枚举值如下：
      - `initialized` ： 初始状态，连接尚未发起。
      - `connecting` ： 连接中，自动重连时也会进入该状态。通过绑定 `connecting_in` `Event` 可以获取下次尝试连接将在多久以后。
      - `connected` ： 连接已建立。
      - `failed` ： 连接无法建立。浏览器不兼容，客户端 SDK 配置错误或过时。通过绑定 `error` `Event` 可以获取具体错误信息。
      - `disconnected`: 之前连接过，现在已被主动断开。

  事件
  -------------------------------
  - **state_changed** 状态改变时触发，处理函数的参数如下：
      - **state** (Object) ： 状态信息，该对象结构如下：

          ```js
          {
            "previous": "oldState",
            "current": "newState"
          }
          ```

  - **connecting_in** 将在几秒后重新连接，处理函数的参数如下：
      - **delay** (Number) ： 用于通知下次重连是在 delay 秒后

  - **error** 发生错误
      - **error** (Object) ： error 信息
 */

Connection = (function(superClass) {
  extend(Connection, superClass);


  /*
   @nodoc
   */

  function Connection(engine) {
    this.engine = engine;
    this._serverAddrManager = new ServerAddrManager(this.engine);
    this._updateState('initialized');
    this._connect();
  }


  /*
   @nodoc
   */

  Connection.prototype._updateState = function(newState) {
    var oldState;
    oldState = this.state;
    if (newState === oldState) {
      return;
    }
    this.state = newState;
    return process.nextTick((function(_this) {
      return function() {
        _this.trigger('state_changed', {
          previous: oldState,
          current: newState
        });
        return _this.trigger(newState);
      };
    })(this));
  };


  /*
   @nodoc
   */

  Connection.prototype._handleConnectionEvent = function(event) {
    switch (event.name) {
      case 'engine_connection:established':
        this.socketId = this._socket.id;
        return this._updateState('connected');
      case 'engine_connection:error':
        this._lastEngineError = event.data;
        return this.trigger('error', {
          code: event.data.code,
          message: event.data.message
        });
    }
  };


  /*
   @nodoc
   */

  Connection.prototype._handleResponseEvent = function(event) {
    var callback;
    callback = this._socket.pendingCallbacks[event.data.to];
    if (!callback) {
      return;
    }
    delete this._socket.pendingCallbacks[event.data.to];
    if (event.data.ok) {
      callback(null, event.data.result);
      if (callback.needSendAck) {
        return this.sendResponseEvent(event.id);
      }
    } else {
      return callback(event.data.error);
    }
  };


  /*
   @nodoc
   */

  Connection.prototype._connect = function(onSocketCreated) {
    var availableEvents, event, fakeSocket, i, len, listener, ref, results, serverAddr, start;
    serverAddr = ((ref = this.engine.options) != null ? ref.serverAddr : void 0) || this._serverAddrManager.addr;
    if (!serverAddr) {
      this._socket = new EventEmitter();
      this._serverAddrManager.refresh();
      this._serverAddrManager.bindOnce('refreshed', (function(_this) {
        return function(err) {
          if (err) {
            _this._lastEngineError = err;
            _this._socket.emit('close');
            return _this._socket = null;
          } else {
            return _this._connect();
          }
        };
      })(this));
      return;
    }
    fakeSocket = this._socket;
    this._socket = new eio.Socket(serverAddr, {
      query: {
        appId: this.engine.appId,
        platform: Utils.getPlatform(),
        sdkVersion: this.engine.version,
        protocol: Protocol.version
      }
    });
    this._socket.pendingCallbacks = {};
    start = new Date().getTime();
    this._socket.on('open', function() {
      var end;
      end = new Date().getTime();
      return debug('socket open', (end - start) + "ms");
    });
    this._socket.on('message', (function(_this) {
      return function(message) {
        var err, error, event;
        try {
          event = Protocol.decodeEvent(message);
        } catch (error) {
          err = error;
          return _this.trigger('error', err);
        }
        debug('got event', event);
        if (Protocol.connectionEventNamePattern.test(event.name)) {
          return _this._handleConnectionEvent(event);
        } else if (Protocol.responseEventNamePattern.test(event.name)) {
          return _this._handleResponseEvent(event);
        } else {
          return _this.trigger('event', event);
        }
      };
    })(this));
    this._socket.on('close', (function(_this) {
      return function(reason) {
        var callback, eventId, ref1;
        debug('socket close', reason);
        ref1 = _this._socket.pendingCallbacks;
        for (eventId in ref1) {
          callback = ref1[eventId];
          callback(Protocol.responseErrors.noConnection);
        }
        _this._socket = null;
        return _this.socketId = null;
      };
    })(this));
    this._socket.on('error', function(err) {
      return debug('socket error', err);
    });
    this._socket.on('upgradeError', function(err) {
      return debug('socket upgradeError', err);
    });
    if (fakeSocket) {
      availableEvents = ['open', 'message', 'close', 'error', 'flush', 'drain', 'upgradeError', 'upgrade'];
      results = [];
      for (i = 0, len = availableEvents.length; i < len; i++) {
        event = availableEvents[i];
        results.push((function() {
          var j, len1, ref1, results1;
          ref1 = fakeSocket.listeners(event);
          results1 = [];
          for (j = 0, len1 = ref1.length; j < len1; j++) {
            listener = ref1[j];
            results1.push(this._socket.on(event, listener));
          }
          return results1;
        }).call(this));
      }
      return results;
    }
  };


  /*
   @nodoc
    If it's a sync call, return boolean to indicate whether event is sent,
    otherwise callback with error when the connection is not available
    TODO: Retry
   */

  Connection.prototype.sendEvent = function(name, data, callback) {
    var message;
    if (typeof data === 'function') {
      callback = data;
      data = null;
    }
    if (this.state === 'connected') {
      if (this.eventId == null) {
        this.eventId = 0;
      }
      this.eventId++;
      message = Protocol.encodeEvent({
        id: this.eventId,
        name: name,
        data: data
      });
      debug('send event', {
        id: this.eventId,
        name: name,
        data: data
      });
      this._socket.send(message);
      if (callback) {
        if (callback) {
          return this._socket.pendingCallbacks[this.eventId] = callback;
        }
      } else {
        return true;
      }
    } else {
      if (callback) {
        return setTimeout(function() {
          return callback(Protocol.responseErrors.noConnection);
        }, 0);
      } else {
        return false;
      }
    }
  };


  /*
   @nodoc
   */

  Connection.prototype.sendResponseEvent = function(eventId, err, result) {
    var data;
    data = {
      to: eventId
    };
    if (err) {
      data.ok = false;
      data.err = err;
    } else {
      data.ok = true;
      if (result) {
        data.result = result;
      }
    }
    return this.sendEvent('engine_response', data);
  };


  /*
    @example 断开连接
      engine.connection.disconnect();
    断开连接
   */

  Connection.prototype.disconnect = function() {
    var ref;
    if ((ref = this._socket) != null) {
      if (typeof ref.close === "function") {
        ref.close();
      }
    }
    return this._updateState('disconnected');
  };


  /*
    @example 恢复连接
      engine.connection.connect();
    恢复连接
   */

  Connection.prototype.connect = function() {
    if (this.state !== 'disconnected') {
      return;
    }
    return this._connect();
  };

  return Connection;

})(EventEmitter);

module.exports = Connection;



}).call(this,require('_process'))
},{"../protocol":29,"../utils":31,"../utils/eventEmitter":30,"./serverAddrManager":27,"_process":78,"debug":38,"engine.io-client":41}],26:[function(require,module,exports){
'use strict';
var AutoReconnectConnection, Connection, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:connection');

Connection = require('./connection');


/*
 @nodoc
 * Enhance Connection with auto reconnect function.
 *
 * Emit following state change related events:
 *   - connecting - connection is being established
 *   - failed - when the connection strategy is not supported
 */

AutoReconnectConnection = (function(superClass) {
  extend(AutoReconnectConnection, superClass);

  function AutoReconnectConnection(engine) {
    this.engine = engine;
    AutoReconnectConnection.__super__.constructor.call(this, this.engine);
    this._resetReconnectState();
  }

  AutoReconnectConnection.prototype._resetReconnectState = function() {
    this._reconnectState = {
      count: 0,
      startTime: null,
      strategy: 'backoff',
      "in": 0,
      inMax: 10 * 1000
    };
    if (this._reconnectTimer != null) {
      clearTimeout(this._reconnectTimer);
      return this._reconnectTimer = null;
    }
  };

  AutoReconnectConnection.prototype._reconnect = function(reconnectStrategy, reconnectIn, reconnectInMax) {
    var backoffIn, base, error, ref, ref1, ref2, ref3;
    if ((ref = this.state) === 'disconnected' || ref === 'failed') {
      return;
    }
    if (this._reconnectTimer) {
      return;
    }
    if (this._lastEngineError) {
      error = this._lastEngineError;
      this._lastEngineError = null;
      if ((4000 <= (ref1 = error.code) && ref1 <= 4099)) {
        return this._updateState('failed');
      } else if ((4100 <= (ref2 = error.code) && ref2 <= 4199)) {
        if (error.reconnectRefreshServerAddr) {
          this._serverAddrManager.refresh();
        }
        return this._reconnect(error.reconnectStrategy, error.reconnectIn, error.reconnectInMax);
      } else if ((4200 <= (ref3 = error.code) && ref3 <= 4399)) {
        return this._reconnect();
      }
    }
    (base = this._reconnectState).startTime || (base.startTime = new Date());
    this._reconnectState.strategy = reconnectStrategy || this._reconnectState.strategy;
    this._reconnectState["in"] = reconnectIn != null ? reconnectIn : this._reconnectState["in"];
    this._reconnectState.inMax = reconnectInMax != null ? reconnectInMax : this._reconnectState.inMax;
    switch (this._reconnectState.strategy) {
      case 'backoff':
        if (this._reconnectState.count > 0) {
          backoffIn = this._reconnectState["in"] * 2 || 1;
        } else {
          backoffIn = this._reconnectState["in"];
        }
        this._reconnectState["in"] = Math.min(this._reconnectState.inMax, backoffIn);
        break;
      case 'static':
        this._reconnectState["in"] = reconnectIn != null ? reconnectIn : this._reconnectState["in"];
    }
    this._reconnectTimer = setTimeout((function(_this) {
      return function() {
        _this._reconnectTimer = null;
        _this._serverAddrManager.refresh();
        _this._connect();
        return _this._reconnectState.count++;
      };
    })(this), this._reconnectState["in"]);
    debug('reconnect', this._reconnectState);
    this.trigger('connecting_in', this._reconnectState["in"]);
    return this._updateState('connecting');
  };

  AutoReconnectConnection.prototype._connect = function() {
    this._updateState('connecting');
    AutoReconnectConnection.__super__._connect.call(this);
    this._socket.on('open', (function(_this) {
      return function() {
        return _this._resetReconnectState();
      };
    })(this));
    return this._socket.on('close', (function(_this) {
      return function() {
        return _this._reconnect();
      };
    })(this));
  };

  AutoReconnectConnection.prototype.disconnect = function() {
    AutoReconnectConnection.__super__.disconnect.call(this);
    return this._resetReconnectState();
  };

  return AutoReconnectConnection;

})(Connection);

module.exports = AutoReconnectConnection;



},{"./connection":25,"debug":38}],27:[function(require,module,exports){
'use strict';
var EventEmitter, GET_SERVER_ADDR_URL, Requester, ServerAddrManager, debug,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:connection:serverAddrManager');

EventEmitter = require('../utils/eventEmitter');

Requester = require('../utils/requester');

GET_SERVER_ADDR_URL = 'https://api.tuisongbao.com:443/v2/sdk/engine/server';


/*
  @nodoc
 */

ServerAddrManager = (function(superClass) {
  extend(ServerAddrManager, superClass);

  function ServerAddrManager(engine) {
    this.engine = engine;
    this._refreshing = false;
  }

  ServerAddrManager.prototype.refresh = function() {
    var startAt;
    if (this._refreshing) {
      return;
    }
    this.addr = null;
    this._refreshing = true;
    startAt = new Date().getTime();
    return Requester.getWithJSONPFallback(GET_SERVER_ADDR_URL, {
      appId: this.engine.appId
    }, (function(_this) {
      return function(err, res) {
        var endAt;
        endAt = new Date().getTime();
        debug('Got server addr response', {
          err: err,
          res: res,
          elapsed: (endAt - startAt) + "ms"
        });
        _this._refreshing = false;
        if (err) {
          return _this.trigger('refreshed', err);
        } else {
          _this.addr = res.addr;
          return _this.trigger('refreshed');
        }
      };
    })(this), this.engine.options);
  };

  return ServerAddrManager;

})(EventEmitter);

module.exports = ServerAddrManager;



},{"../utils/eventEmitter":30,"../utils/requester":33,"debug":38}],28:[function(require,module,exports){
'use strict';
var Authorizer, Channels, ChatManager, Connection, Engine, Promise, Protocol, Utils, _log, debug,
  slice = [].slice;

_log = require('debug').log;

require('debug').log = function() {
  var arg, args, formattedArgs;
  args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
  formattedArgs = (function() {
    var error, i, len, results;
    results = [];
    for (i = 0, len = args.length; i < len; i++) {
      arg = args[i];
      try {
        if (arg instanceof Error) {
          results.push(arg);
        } else {
          results.push(JSON.stringify(arg));
        }
      } catch (error) {
        results.push(arg);
      }
    }
    return results;
  })();
  return _log.apply(this, formattedArgs);
};

debug = require('debug')('engine:index');

Utils = require('./utils');

Connection = require('./connection');

Authorizer = require('./authorizer');

Channels = require('./channels');

ChatManager = require('./chat');

Protocol = require('./protocol');

Promise = require('./utils/promise');


/*
  推送宝实时引擎客户端 SDK 的入口

  属性
  --------------------------------------------------------

  - **chatManager** ([ChatManager](./ChatManager.html)) - Chat 管理对象
  - **channels** ([Channel](./Channels.html)) - Channel 管理对象
  - **connection**  ([Connection](./Connection.html)) - Connection 管理对象
 */

Engine = (function() {

  /*
    构造函数.
  
    @example 实例化 Engine
      var options = {
        authEndpoint: '/api/engineDemo/authUser',
        authTransport: 'jsonp',
        basePath: '/engine/clientJavaScript/',
        chat: {
          enableCache: true,
          enableMediaMessage: true
        }
      };
  
      var engine = new Engine('YOUR_APP_ID', options);
  
    @param [Sting] @appId YOUR_APP_ID
    @param [Object] options 构造参数
    @option options [String] `authEndpoint`
      认证用户请求方式，默认为 `xhr` ，使用 `XMLHttpRequest`
      ，但是该方式在 IE8/9 上存在跨域问题，如果你配置的 `authEndpoint` 跨域并且需要支持 IE8/9
      ，应使用 `jsonp` ，同时请确保你的服务端支持 `jsonp` 请求，该设置在所有浏览器上生效，并非仅在 IE8/9 上生效
    @option options [String] authData 如果配置，认证请求将携带该值，可以用来表明用户身份。当结合 jsonp 使用时，该值如果为 Object ，会被序列化成 JSON 字符串, 可选。
    @option options [String] basePath 扩展功能 `Lib` 的地址
    @option options [Object] chat chat 的功能配置
    @option options [Object] chat
      chat 为 engine 上 chat 相关的配置，配置方法如下：
      chat: {扩展功能: true | false ...}
   */
  function Engine(appId, options) {
    this.appId = appId;
    this.options = options;
    if (!this.appId) {
      Utils.throwError('appId is required.');
    }
    this.version = 'v2.1.0';
    this.connection = new Connection(this);
    this.authorizer = new Authorizer(this);
    this.channels = new Channels(this);
    this.chatManager = new ChatManager(this);
    if (typeof window !== "undefined" && window !== null) {
      if (window.Promise == null) {
        window.Promise = Promise;
      }
    }
    this.connection.bind('state_changed', function(states) {
      return debug('connection state_changed', states);
    });
    this.connection.bind('connecting_in', function(delay) {
      return debug('connection connecting_in', delay);
    });
    this.connection.bind('connected', (function(_this) {
      return function() {
        _this.channels.subscribeAll();
        return _this.chatManager.autoLogin();
      };
    })(this));
    this.connection.bind('event', (function(_this) {
      return function(event) {
        var channel;
        if (event.channel) {
          channel = _this.channels.find(event.channel);
          return channel.handleEvent(event);
        } else if (Protocol.chatEventNamePattern.test(event.name)) {
          return _this.chatManager.handleEvent(event);
        }
      };
    })(this));
    this.connection.bind('error', function(err) {
      return debug('connection error', err);
    });
    this.connection.bind('disconnected', (function(_this) {
      return function() {
        _this.chatManager.handleNoConnectionOperations(true);
        return _this.channels.disconnect();
      };
    })(this));
  }

  Engine.debug = require('debug');

  return Engine;

})();

if (typeof window !== "undefined" && window !== null) {
  window.Engine = Engine;
}

module.exports = Engine;



},{"./authorizer":1,"./channels":3,"./chat":17,"./connection":26,"./protocol":29,"./utils":31,"./utils/promise":32,"debug":38}],29:[function(require,module,exports){
'use strict';
var BaseProtocol, Protocol, utils,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

BaseProtocol = require('../protocol');

utils = require('./utils');


/*
  @nodoc
 */

Protocol = (function(superClass) {
  extend(Protocol, superClass);

  function Protocol() {
    return Protocol.__super__.constructor.apply(this, arguments);
  }

  Protocol._throwError = utils.throwError;

  return Protocol;

})(BaseProtocol);

module.exports = Protocol;



},{"../protocol":37,"./utils":31}],30:[function(require,module,exports){
'use strict';
var EventEmitter, events,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

events = require('events');


/*
  事件相关
 */

EventEmitter = (function(superClass) {
  extend(EventEmitter, superClass);

  function EventEmitter() {
    return EventEmitter.__super__.constructor.apply(this, arguments);
  }


  /*
    添加一个 handler 到特定事件的 handler 数组中
   */

  EventEmitter.prototype.bind = function() {
    return this.on.apply(this, arguments);
  };


  /*
    添加一个一次性 handler ，这个 handler 只会在下一次事件发生时被触发一次，触发完成后就被删除。
   */

  EventEmitter.prototype.bindOnce = function() {
    return this.once.apply(this, arguments);
  };


  /*
    根据参数中 handler ，从 handler 数组中删除 evnet 相关的一个 handler 或全部 handler
   */

  EventEmitter.prototype.unbind = function(event, handler) {
    if (handler) {
      return this.removeListener(event, handler);
    } else {
      return this.removeAllListeners(event);
    }
  };


  /*
    使用提供的参数按顺序执行指定事件的 handler
   */

  EventEmitter.prototype.trigger = function() {
    return this.emit.apply(this, arguments);
  };


  /*
    返回指定事件的 handler 数组
   */

  EventEmitter.prototype.handlers = function() {
    return this.listeners.apply(this, arguments);
  };

  return EventEmitter;

})(events.EventEmitter);

module.exports = EventEmitter;



},{"events":77}],31:[function(require,module,exports){
(function (process){
'use strict';

/*
  @nodoc
 */
var Utils;

Utils = (function() {
  function Utils() {}

  Utils.createError = function(error) {
    var err;
    err = new Error(error.message || error);
    err.name = 'EngineError';
    if (err.code == null) {
      err.code = error.code || -1;
    }
    return err;
  };

  Utils.throwError = function(error) {
    throw Utils.createError(error);
  };

  Utils.genRandomStr = function() {
    var i, possibleChars, randomChars;
    possibleChars = 'abcdefghijklmnopqrstuvwxyz_';
    randomChars = (function() {
      var j, results;
      results = [];
      for (i = j = 0; j < 20; i = ++j) {
        results.push(possibleChars[Math.floor(Math.random() * possibleChars.length)]);
      }
      return results;
    })();
    return randomChars.join('');
  };

  Utils.checkBrowser = (function() {
    var match, platform_match, ret, ua;
    if (typeof window === "undefined" || window === null) {
      return function() {
        return {};
      };
    }
    ua = window.navigator.userAgent.toLowerCase();
    match = /(edge)\/([\w.]+)/.exec(ua) || /(opr)[\/]([\w.]+)/.exec(ua) || /(chrome)[ \/]([\w.]+)/.exec(ua);
    match || (match = /(version)(applewebkit)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua));
    match || (match = /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/.exec(ua));
    match || (match = /(webkit)[ \/]([\w.]+)/.exec(ua) || /(opera)(?:.*version|)[ \/]([\w.]+)/.exec(ua));
    match || (match = /(msie) ([\w.]+)/.exec(ua) || ua.indexOf('trident') >= 0 && /(rv)(?::| )([\w.]+)/.exec(ua));
    match || (match = ua.indexOf('compatible') < 0 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua) || []);
    platform_match = /(ipad)/.exec(ua) || /(ipod)/.exec(ua) || /(iphone)/.exec(ua) || /(kindle)/.exec(ua);
    platform_match || (platform_match = /(silk)/.exec(ua) || /(android)/.exec(ua) || /(windows phone)/.exec(ua) || /(win)/.exec(ua));
    platform_match || (platform_match = /(mac)/.exec(ua) || /(linux)/.exec(ua) || /(cros)/.exec(ua) || /(playbook)/.exec(ua));
    platform_match || (platform_match = /(bb)/.exec(ua) || /(blackberry)/.exec(ua) || []);
    ret = {
      browser: match[5] || match[3] || match[1] || '',
      version: match[2] || match[4] || '0',
      versionNumber: match[4] || match[2] || '0',
      platform: platform_match[0] || ''
    };
    return function() {
      return ret;
    };
  })();

  Utils.getPlatform = (function() {
    var ret;
    if (typeof window !== "undefined" && window !== null) {
      ret = window.navigator.userAgent;
    } else {
      ret = "Node.js " + process.version + "$" + process.platform + "$" + process.arch;
    }
    return function() {
      return ret;
    };
  })();

  return Utils;

})();

module.exports = Utils;



}).call(this,require('_process'))
},{"_process":78}],32:[function(require,module,exports){
'use strict';
var FULFILLED, PENDING, Promise, REJECTED, Utils, chatManagerUtil, debug, isArray, isFunction, isThenable,
  hasProp = {}.hasOwnProperty;

debug = require('debug')('engine:promise');

Utils = require('../utils');

chatManagerUtil = require('../chat/chatManagerUtil');

PENDING = void 0;

FULFILLED = 1;

REJECTED = 2;

isFunction = function(obj) {
  return 'function' === typeof obj;
};

isArray = function(obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

isThenable = function(obj) {
  return obj && typeof obj['then'] === 'function';
};


/*
  ES6 Promise
  @see http://es6.ruanyifeng.com/#docs/promise ES6 Promise
 */

Promise = (function() {
  function Promise(resolver) {
    var reject, resolve;
    if (!isFunction(resolver)) {
      throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
    }
    if (!(this instanceof Promise)) {
      return new Promise(resolver);
    }
    this._value;
    this._reason;
    this._status = PENDING;
    this._resolveHandlers = [];
    this._rejectHandlers = [];
    resolve = (function(_this) {
      return function(value) {
        return _this.transite(FULFILLED, value);
      };
    })(this);
    reject = (function(_this) {
      return function(reason) {
        return _this.transite(REJECTED, reason);
      };
    })(this);
    resolver(resolve, reject);
  }


  /*
    @nodoc
   */

  Promise.prototype.transite = function(status, value) {
    if (this._status !== PENDING) {
      return;
    }
    return setTimeout((function(_this) {
      return function() {
        _this._status = status;
        return _this._publish(value);
      };
    })(this), 0);
  };


  /*
    @nodoc
   */

  Promise.prototype._publish = function(val) {
    var fn, queue, st;
    st = this._status === FULFILLED;
    queue = this[st ? '_resolveHandlers' : '_rejectHandlers'];
    if (queue !== void 0) {
      while (fn = queue.shift()) {
        val = fn.call(this, val) || val;
      }
    }
    this[st ? '_value' : '_reason'] = val;
    return this['_resolveHandlers'] = this['_rejectHandlers'] = void 0;
  };

  Promise.prototype.then = function(onFulfilled, onRejected) {
    var promise;
    promise = this;
    return new Promise(function(resolve, reject) {
      var callback, errback;
      callback = function(value) {
        var e, error, ret;
        try {
          ret = isFunction(onFulfilled) && onFulfilled(value) || value;
          if (isThenable(ret)) {
            return ret.then(function(value) {
              return resolve(value);
            }, function(reason) {
              return reject(reason);
            });
          } else {
            return resolve(ret);
          }
        } catch (error) {
          e = error;
          return reject(e);
        }
      };
      errback = function(reason) {
        reason = isFunction(onRejected) && onRejected(reason) || reason;
        return reject(reason);
      };
      if (promise._status === PENDING) {
        promise._resolveHandlers.push(callback);
        return promise._rejectHandlers.push(errback);
      } else if (promise._status === FULFILLED) {
        return callback(promise._value);
      } else if (promise._status === REJECTED) {
        return errback(promise._reason);
      }
    });
  };

  Promise.prototype["catch"] = function(onRejected) {
    return this.then(void 0, onRejected);
  };

  Promise.prototype.delay = function(ms) {
    return this.then(function(val) {
      return Promise.delay(ms, val);
    });
  };

  return Promise;

})();

Promise.delay = function(ms, val) {
  return new Promise(function(resolve, reject) {
    var err, error;
    try {
      return setTimeout(function() {
        return resolve(val);
      }, ms);
    } catch (error) {
      err = error;
      return reject(err);
    }
  });
};

Promise.resolve = function(arg) {
  return new Promise(function(resolve, reject) {
    var err, error;
    try {
      return resolve(arg);
    } catch (error) {
      err = error;
      return reject(err);
    }
  });
};

Promise.reject = function(arg) {
  return new Promise(function(resolve, reject) {
    var err, error;
    try {
      return reject(arg);
    } catch (error) {
      err = error;
      return reject(err);
    }
  });
};

Promise.all = function(promises) {
  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to all.');
  }
  return new Promise(function(resolve, reject) {
    var i, length, ref, rejecter, resolveAll, resolver, result, results;
    i = 0;
    result = [];
    length = promises.length;
    if (length === 0) {
      return resolve([]);
    }
    resolver = function(index) {
      return function(value) {
        return resolveAll(index, value);
      };
    };
    rejecter = function(reason) {
      return reject(reason);
    };
    resolveAll = function(index, value) {
      result[index] = value;
      if (index === (length - 1)) {
        return resolve(result);
      }
    };
    results = [];
    while (i < length) {
      if ((ref = promises[i]) != null) {
        if (typeof ref.then === "function") {
          ref.then(resolver(i), rejecter);
        }
      }
      results.push(i++);
    }
    return results;
  });
};

Promise.toPromise = function(clazz, includeFuncNames, excludeFuncNames) {
  var k, ref, results, v;
  ref = clazz.prototype;
  results = [];
  for (k in ref) {
    if (!hasProp.call(ref, k)) continue;
    v = ref[k];
    if (!isFunction(v)) {
      continue;
    }
    if (k === 'constructor') {
      continue;
    }
    if ((includeFuncNames != null ? includeFuncNames.indexOf(k) : void 0) < 0) {
      continue;
    }
    if ((excludeFuncNames != null ? excludeFuncNames.indexOf(k) : void 0) > -1) {
      continue;
    }
    results.push((function(k, v) {
      return clazz.prototype[k] = function(options) {
        var onError, optionsCopy, promise;
        if (options == null) {
          options = {};
        }
        if ((options.onSuccess != null) || (options.onError != null) || (typeof options) !== 'object') {
          if ((typeof options) === 'object' && isFunction(options.onError)) {
            onError = options.onError;
            options.onError = function(err) {
              err = Utils.createError(err);
              debug(k + ":" + v, err);
              return onError(err);
            };
          }
          return v.apply(this, arguments);
        }
        if (arguments.length > 1) {
          return v.apply(this, arguments);
        }
        optionsCopy = chatManagerUtil.getPromiseOption(options);
        promise = new Promise(function(resolve, reject) {
          optionsCopy.onSuccess = function(result) {
            return resolve(result);
          };
          return optionsCopy.onError = function(err) {
            err = Utils.createError(err);
            debug(k + ":" + v, err);
            return reject(err);
          };
        });
        v.call(this, optionsCopy);
        return promise;
      };
    })(k, v));
  }
  return results;
};

module.exports = Promise;



},{"../chat/chatManagerUtil":10,"../utils":31,"debug":38}],33:[function(require,module,exports){
'use strict';
var BrowserRequester, NodeRequester, Utils, browserInfo, debug, formatGetUrl, jsonpRequest, needJSONP, request, xmlHttpRequest;

debug = require('debug')('engine:utils:requester');

request = require('superagent');

jsonpRequest = require('./jsonpRequest');

xmlHttpRequest = require('./xmlHttpRequest');

Utils = require('../index');

browserInfo = Utils.checkBrowser();

needJSONP = browserInfo.browser === 'msie' && parseFloat(browserInfo.versionNumber) < 10 ? true : false;

formatGetUrl = function(url, data) {
  var key, queryPairs, value;
  data.timestamp = new Date().getTime();
  queryPairs = [];
  for (key in data) {
    value = data[key];
    queryPairs.push(key + "=" + value);
  }
  if (url.indexOf('?') === -1) {
    url += '?';
  } else {
    url += '&';
  }
  return url += queryPairs.join('&');
};


/*
  @nodoc
 */

BrowserRequester = (function() {
  function BrowserRequester() {}

  BrowserRequester.get = function(url, data, callback) {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    url = formatGetUrl(url, data);
    debug('xmlHttpRequest.get', {
      url: url,
      data: data
    });
    return xmlHttpRequest.get(url, callback);
  };

  BrowserRequester.getWithJSONPFallback = function(url, data, callback) {
    var requestMethod;
    requestMethod = needJSONP ? this.jsonp : this.get;
    return requestMethod(url, data, callback);
  };

  BrowserRequester.post = function(url, data, callback) {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    debug('xmlHttpRequest.post', {
      url: url,
      data: data
    });
    return xmlHttpRequest.post(url, data, callback);
  };

  BrowserRequester.postWithJSONPFallback = function(url, data, call) {
    var requestMethod;
    requestMethod = needJSONP ? this.jsonp : this.post;
    return requestMethod(url, data, callback);
  };

  BrowserRequester.jsonp = function(url, data, callback) {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    if (!data.callback) {
      data.callback = Utils.genRandomStr();
    }
    url = formatGetUrl(url, data);
    debug('jsonp', {
      url: url,
      data: data
    });
    return jsonpRequest.get(url, callback);
  };

  return BrowserRequester;

})();


/*
  @nodoc
 */

NodeRequester = (function() {
  function NodeRequester() {}

  NodeRequester.get = function(url, data, callback) {
    return request.get(url).query(data).end(function(err, data) {
      return callback(err, data != null ? data.body : void 0);
    });
  };

  NodeRequester.getWithJSONPFallback = NodeRequester.get;

  NodeRequester.post = function(url, data, callback) {
    return request.post(url).send(data).end(function(err, data) {
      return callback(err, data != null ? data.body : void 0);
    });
  };

  NodeRequester.postWithJSONPFallback = NodeRequester.post;

  return NodeRequester;

})();

module.exports = typeof window !== "undefined" && window !== null ? BrowserRequester : NodeRequester;



},{"../index":31,"./jsonpRequest":34,"./xmlHttpRequest":36,"debug":38,"superagent":72}],34:[function(require,module,exports){
'use strict';
var getCallbackFromUrl, loadJS;

loadJS = require('./loadJS.coffee');

getCallbackFromUrl = function(url) {
  var callbackRegExp, matches;
  callbackRegExp = /[\?|&]callback=([a-z0-9_]+)/i;
  matches = url.match(callbackRegExp);
  if (!matches) {
    throw new Error('Could not find callback on URL');
  }
  return matches[1];
};

module.exports.get = function(url, callback) {
  var callbackName, data, err, error, originalCallback;
  try {
    callbackName = getCallbackFromUrl(url);
  } catch (error) {
    err = error;
    return callback(err);
  }
  data = void 0;
  originalCallback = window[callbackName];
  window[callbackName] = function(jsonpData) {
    return data = jsonpData;
  };
  return loadJS.load(url).then(function() {
    return callback(null, data);
  })["catch"](function(err) {
    var error1;
    if (!err && !data) {
      err = new Error('JSONP requeset can not get a JSON response');
    }
    if (originalCallback) {
      window[callbackName] = originalCallback;
    } else {
      try {
        delete window[callbackName];
      } catch (error1) {
        err = error1;
        window[callbackName] = void 0;
      }
    }
    return callback(err, data);
  });
};



},{"./loadJS.coffee":35}],35:[function(require,module,exports){
'use strict';
var LoadJS, Promise, debug, loadJS;

Promise = require('../promise');

debug = require('debug')('engine:loadJS');


/*
  @nodoc
 */

LoadJS = (function() {
  function LoadJS() {
    this.loaded = {};
  }

  LoadJS.prototype.load = function() {
    var _arg, arg, i, len, promiseBlock;
    if (arguments.length === 0) {
      return Promise.reject('arguments error');
    }
    promiseBlock = [];
    for (i = 0, len = arguments.length; i < len; i++) {
      arg = arguments[i];
      if (arg instanceof Array) {
        promiseBlock = (function() {
          var j, len1, results;
          results = [];
          for (j = 0, len1 = arg.length; j < len1; j++) {
            _arg = arg[j];
            results.push(this._load(_arg));
          }
          return results;
        }).call(this);
      } else {
        promiseBlock.push(this._load(arg));
      }
    }
    return Promise.all(promiseBlock);
  };

  LoadJS.prototype._load = function(url) {
    var promise, self;
    self = this;
    return promise = new Promise(function(resolve, reject) {
      var head, script, timeoutTimer, timer;
      if (self.loaded[url] === 'loaded') {
        return resolve('loaded');
      } else if (self.loaded[url] === 'loading') {
        timer = setInterval(function() {
          if (self.loaded[url] === 'loaded') {
            if (timer != null) {
              clearInterval(timer);
            }
            return resolve('loaded');
          }
        }, 2000);
        return;
      }
      self.loaded[url] = 'loading';
      head = document.getElementsByTagName('head')[0];
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = url;
      script.async = true;
      timeoutTimer = setTimeout(function() {
        return reject('请求超时');
      }, 10000);
      script.onreadystatechange = script.onload = function(result) {
        self.loaded[url] = 'loaded';
        if (timeoutTimer != null) {
          clearTimeout(timeoutTimer);
        }
        return resolve(url);
      };
      script.onerror = function(err) {
        self.loaded[url] = 'error';
        debug('loadJS error', url, err);
        if (timeoutTimer != null) {
          clearTimeout(timeoutTimer);
        }
        return reject(new Error(err));
      };
      return head.appendChild(script);
    });
  };

  LoadJS.prototype.getExtensionJS = function(extension) {
    var exJS, extensionJS, i, j, k, l, len, len1, len2, path, pathMapping, ref, ref1, v;
    pathMapping = {
      'enableCache': ['indexeddbshim.min.js', 'db.min.js'],
      'enableMediaMessage': ['plupload.min.js', 'qiniu.min.js', 'RecordRTC.js']
    };
    extensionJS = [];
    if (Object.prototype.toString.call(extension) === '[object Array]') {
      for (i = 0, len = extension.length; i < len; i++) {
        exJS = extension[i];
        if (pathMapping[exJS]) {
          ref = pathMapping[exJS];
          for (j = 0, len1 = ref.length; j < len1; j++) {
            path = ref[j];
            extensionJS.push(path);
          }
        }
      }
    } else {
      for (k in extension) {
        v = extension[k];
        if ('function' !== typeof v && v) {
          ref1 = pathMapping[k];
          for (l = 0, len2 = ref1.length; l < len2; l++) {
            path = ref1[l];
            extensionJS.push(path);
          }
        }
      }
    }
    return extensionJS;
  };

  LoadJS.prototype.getExtensionJSPaths = function(extensionJSPath, basePath) {
    var regExp;
    regExp = new RegExp('^[A-Za-z]+://[A-Za-z0-9-_]+\\.[A-Za-z0-9-_%&\?\/.=]+(js)$');
    if (regExp.test(extensionJSPath)) {
      return extensionJSPath;
    }
    this.basePath = basePath || '/';
    if (this.basePath == null) {
      this.throwError('If you want to use the extension, You must specify the base path!');
    }
    basePath = this.basePath.charAt(this.basePath.length - 1) === '/' ? this.basePath + "libs/" : this.basePath + "/libs/";
    return "" + basePath + extensionJSPath;
  };

  LoadJS.prototype.requireExtensionJSPaths = function(name, basePath) {
    var extensionJSPath, extensionJSPaths, i, len, ref;
    extensionJSPaths = [];
    ref = this.getExtensionJS([name]);
    for (i = 0, len = ref.length; i < len; i++) {
      extensionJSPath = ref[i];
      extensionJSPaths.push(this.getExtensionJSPaths(extensionJSPath));
    }
    return extensionJSPaths;
  };

  LoadJS.prototype.require = function(name, basePath) {
    var extensionJSPath, extensionJSPaths, i, len, ref;
    extensionJSPaths = [];
    ref = this.getExtensionJS([name]);
    for (i = 0, len = ref.length; i < len; i++) {
      extensionJSPath = ref[i];
      extensionJSPaths.push(this.getExtensionJSPaths(extensionJSPath, basePath));
    }
    return this.load(extensionJSPaths);
  };

  return LoadJS;

})();

loadJS = new LoadJS();

module.exports = loadJS;



},{"../promise":32,"debug":38}],36:[function(require,module,exports){
'use strict';
var getXHR, request;

getXHR = function() {
  try {
    if (window.XMLHttpRequest) {
      return new XMLHttpRequest();
    }
  } catch (undefined) {}
};

request = function(method, url, headers, data, cb) {
  var err, error, name, value, xhr;
  if (headers == null) {
    headers = {};
  }
  xhr = getXHR();
  xhr.open(method, url, true);
  for (name in headers) {
    value = headers[name];
    xhr.setRequestHeader(name, value);
  }
  xhr.onload = function() {
    var err, error, responseJSON;
    if (xhr.readyState !== 4) {
      return;
    }
    if (xhr.status !== 200) {
      return cb(new Error("Unexpected response, status: " + xhr.status));
    }
    try {
      responseJSON = JSON.parse(xhr.responseText);
    } catch (error) {
      err = error;
      return cb(err);
    }
    return cb(null, responseJSON);
  };
  xhr.onerror = function() {
    return cb(new Error("Unexpected response, status: " + xhr.status));
  };
  try {
    return xhr.send(data);
  } catch (error) {
    err = error;
    return cb(err);
  }
};

exports.get = function(url, cb) {
  return request('GET', url, null, null, cb);
};

exports.post = function(url, data, cb) {
  var headers;
  headers = {
    'Content-Type': 'application/json'
  };
  data = JSON.stringify(data);
  return request('POST', url, headers, data, cb);
};



},{}],37:[function(require,module,exports){
(function (Buffer){
'use strict';

/**
 * Common protocol related code shared between server and js clent.
 */
var Protocol,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

Protocol = (function() {
  function Protocol() {}

  Protocol.version = 'v1';

  Protocol.eventNameMaxLength = 128;

  Protocol.eventDataMaxSize = 10 * 1024;

  Protocol.channelNamePattern = new RegExp('^[a-zA-Z0-9_\\-=@,.;]+$');

  Protocol.channelNameFullPattern = new RegExp('^[a-zA-Z0-9_\\-=@,.;]{1,128}$');

  Protocol.privateChannelNameFullPattern = new RegExp('^private-[a-zA-Z0-9_\\-=@,.;]{0,120}$');

  Protocol.presenceChannelNameFullPattern = new RegExp('^presence-[a-zA-Z0-9_\\-=@,.;]{0,119}$');

  Protocol.channelNameMaxLength = 128;

  Protocol.presenceChannelUserMaxCount = 1000;

  Protocol.presenceChannelUserIdMaxLength = 128;

  Protocol.presenceChannelUserInfoMaxSize = 1 * 1024;

  Protocol.internalEventNamePattern = new RegExp('^engine_.*');

  Protocol.connectionEventNamePattern = new RegExp('^engine_connection');

  Protocol.channelEventNamePattern = new RegExp('^engine_channel');

  Protocol.chatEventNamePattern = new RegExp('^engine_chat');

  Protocol.responseEventNamePattern = new RegExp('^engine_response$');


  /**
   * 4000 ~ 4099: socket will be closed by server, client should not try to reconnect
   * 4100 ~ 4199: socket will be closed by server, client should try to reconnect as instructed
   * 4200 ~ 4299: socket will be closed by server, client may reconnect immediately
   * 4300 ~ 4399: other errors
   */

  Protocol.connErrors = {
    requestInvalid: {
      code: 4000,
      message: 'Request is invalid.'
    },
    requestProtocolNotSupported: {
      code: 4001,
      message: 'Request protocol is not supported.'
    },
    eventInvalid: {
      code: 4010,
      message: 'Event is invalid.'
    },
    eventNameTooLong: {
      code: 4011,
      message: 'Event name is too long.'
    },
    eventDataTooBig: {
      code: 4012,
      message: 'Event data is too big.'
    },
    appNotExists: {
      code: 4020,
      message: 'App does not exist.'
    },
    appDisabled: {
      code: 4021,
      message: 'App is disabled.'
    },
    serverInternalError: {
      code: 4100,
      message: 'Server internal error, please try again later.',
      reconnectStrategy: 'static',
      reconnectIn: 1 * 60 * 1000
    },
    serverMaintenance: {
      code: 4101,
      message: 'Server is under maintenance, please try again later.',
      reconnectStrategy: 'backoff',
      reconnectIn: 30 * 1000,
      reconnectInMax: 5 * 60 * 1000
    },
    serverOverCapacity: {
      code: 4102,
      message: 'Server is over capacity, please try again later.',
      reconnectStrategy: 'backoff',
      reconnectIn: 10 * 1000,
      reconnectInMax: 5 * 60 * 1000
    },
    appOverConnectionQuota: {
      code: 4110,
      message: 'App is over connection quota, please try again later.',
      reconnectStrategy: 'static',
      reconnectIn: 10 * 60 * 1000
    }
  };


  /**
   * 4500 ~ 4999
   */

  Protocol.responseErrors = {
    noConnection: {
      code: 4500,
      message: 'Connection is not available, please check your network configuration.'
    },
    serverInternalError: {
      code: 4501,
      message: 'Server internal error, please try again later.'
    },
    incorrectSignature: {
      code: 4502,
      message: 'Incorrect signature.'
    },
    unauthorized: {
      code: 4503,
      message: 'Unauthorized, please login first.'
    },
    invalidRequest: {
      code: 4504,
      message: 'Invalid request.'
    },
    permissionDenied: {
      code: 4505,
      message: 'Permission denied.'
    },
    fileOperationFailed: {
      code: 4506,
      message: 'File operation failed.'
    },
    requestTimeout: {
      code: 4507,
      message: 'Request timed out.'
    }
  };

  Protocol._throwError = function(err) {
    throw err;
  };

  Protocol._validateEvent = function(event, restrictDataSize) {
    var eventDataSize;
    if (!(event.id && event.name)) {
      this._throwError(this.connErrors.eventInvalid);
    }
    if (event.name.length > this.eventNameMaxLength) {
      this._throwError(this.connErrors.eventNameTooLong);
    }
    if (!restrictDataSize) {
      return;
    }
    eventDataSize = Buffer.byteLength(JSON.stringify(event.data), 'utf8');
    if (eventDataSize > this.eventDataMaxSize) {
      return this._throwError(this.connErrors.eventDataTooBig);
    }
  };

  Protocol.decodeEvent = function(event) {
    var err, error;
    try {
      event = JSON.parse(event);
    } catch (error) {
      err = error;
      this._throwError(this.connErrors.eventInvalid);
    }
    this._validateEvent(event);
    return event;
  };

  Protocol.encodeEvent = function(event, restrictDataSize) {
    if (restrictDataSize == null) {
      restrictDataSize = true;
    }
    this._validateEvent(event, restrictDataSize);
    return JSON.stringify(event);
  };

  Protocol.validateChannel = function(name) {
    var type;
    if (!name) {
      this._throwError(new Error('Channel name is required.'));
    }
    if (!this.channelNamePattern.test(name)) {
      this._throwError(new Error('Channel name contains invalid character.'));
    }
    if (name.length > this.channelNameMaxLength) {
      this._throwError(new Error('Channel name is too long.'));
    }
    type = 'channel';
    if (this.privateChannelNameFullPattern.test(name)) {
      type = 'privateChannel';
    } else if (this.presenceChannelNameFullPattern.test(name)) {
      type = 'presenceChannel';
    }
    return type;
  };

  Protocol.validatePresenceChannelUser = function(existingUserIds, user) {
    var ref, uniqueUserIds, userInfoSize;
    uniqueUserIds = _.unique(existingUserIds);
    if (uniqueUserIds.length >= this.presenceChannelUserMaxCount && (ref = user.userId, indexOf.call(uniqueUserIds, ref) < 0)) {
      this._throwError(new Error('Exceeds max presence channel user count.'));
    }
    userInfoSize = Buffer.byteLength(JSON.stringify(user.userInfo), 'utf8');
    if (userInfoSize > this.presenceChannelUserInfoMaxSize) {
      return this._throwError(new Error('Exceeds max user info size.'));
    }
  };

  return Protocol;

})();

module.exports = Protocol;



}).call(this,require("buffer").Buffer)
},{"buffer":73}],38:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [
  'cyan',
  'green',
  'goldenrod', // "yellow" is just too bright on a white background...
  'blue',
  'purple',
  'red'
];

/**
 * Currently only WebKit-based Web Inspectors and the Firebug
 * extension (*not* the built-in Firefox web inpector) are
 * known to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table)));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? '%c ' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (useColors) {
    var c = 'color: ' + this.color;
    args = [args[0], c, ''].concat(Array.prototype.slice.call(args, 1));

    // the final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    var index = 0;
    var lastC = 0;
    args[0].replace(/%[a-z%]/g, function(match) {
      if ('%%' === match) return;
      index++;
      if ('%c' === match) {
        // we only are interested in the *last* %c
        // (the user may have provided their own)
        lastC = index;
      }
    });

    args.splice(lastC, 0, c);
  }

  // This hackery is required for IE8,
  // where the `console.log` function doesn't have 'apply'
  return 'object' == typeof console
    && 'function' == typeof console.log
    && Function.prototype.apply.call(console.log, console, args);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      localStorage.removeItem('debug');
    } else {
      localStorage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = localStorage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":39}],39:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    exports.log.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace('*', '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":40}],40:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} options
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options){
  options = options || {};
  if ('string' == typeof val) return parse(val);
  return options.long
    ? long(val)
    : short(val);
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  var match = /^((?:\d+)?\.?\d+) *(ms|seconds?|s|minutes?|m|hours?|h|days?|d|years?|y)?$/i.exec(str);
  if (!match) return;
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 's':
      return n * s;
    case 'ms':
      return n;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function short(ms) {
  if (ms >= d) return Math.round(ms / d) + 'd';
  if (ms >= h) return Math.round(ms / h) + 'h';
  if (ms >= m) return Math.round(ms / m) + 'm';
  if (ms >= s) return Math.round(ms / s) + 's';
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function long(ms) {
  return plural(ms, d, 'day')
    || plural(ms, h, 'hour')
    || plural(ms, m, 'minute')
    || plural(ms, s, 'second')
    || ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) return;
  if (ms < n * 1.5) return Math.floor(ms / n) + ' ' + name;
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],41:[function(require,module,exports){

module.exports =  require('./lib/');

},{"./lib/":42}],42:[function(require,module,exports){

module.exports = require('./socket');

/**
 * Exports parser
 *
 * @api public
 *
 */
module.exports.parser = require('engine.io-parser');

},{"./socket":43,"engine.io-parser":56}],43:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var transports = require('./transports');
var Emitter = require('component-emitter');
var debug = require('debug')('engine.io-client:socket');
var index = require('indexof');
var parser = require('engine.io-parser');
var parseuri = require('parseuri');
var parsejson = require('parsejson');
var parseqs = require('parseqs');

/**
 * Module exports.
 */

module.exports = Socket;

/**
 * Noop function.
 *
 * @api private
 */

function noop(){}

/**
 * Socket constructor.
 *
 * @param {String|Object} uri or options
 * @param {Object} options
 * @api public
 */

function Socket(uri, opts){
  if (!(this instanceof Socket)) return new Socket(uri, opts);

  opts = opts || {};

  if (uri && 'object' == typeof uri) {
    opts = uri;
    uri = null;
  }

  if (uri) {
    uri = parseuri(uri);
    opts.host = uri.host;
    opts.secure = uri.protocol == 'https' || uri.protocol == 'wss';
    opts.port = uri.port;
    if (uri.query) opts.query = uri.query;
  }

  this.secure = null != opts.secure ? opts.secure :
    (global.location && 'https:' == location.protocol);

  if (opts.host) {
    var pieces = opts.host.split(':');
    opts.hostname = pieces.shift();
    if (pieces.length) {
      opts.port = pieces.pop();
    } else if (!opts.port) {
      // if no port is specified manually, use the protocol default
      opts.port = this.secure ? '443' : '80';
    }
  }

  this.agent = opts.agent || false;
  this.hostname = opts.hostname ||
    (global.location ? location.hostname : 'localhost');
  this.port = opts.port || (global.location && location.port ?
       location.port :
       (this.secure ? 443 : 80));
  this.query = opts.query || {};
  if ('string' == typeof this.query) this.query = parseqs.decode(this.query);
  this.upgrade = false !== opts.upgrade;
  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
  this.forceJSONP = !!opts.forceJSONP;
  this.jsonp = false !== opts.jsonp;
  this.forceBase64 = !!opts.forceBase64;
  this.enablesXDR = !!opts.enablesXDR;
  this.timestampParam = opts.timestampParam || 't';
  this.timestampRequests = opts.timestampRequests;
  this.transports = opts.transports || ['polling', 'websocket'];
  this.readyState = '';
  this.writeBuffer = [];
  this.callbackBuffer = [];
  this.policyPort = opts.policyPort || 843;
  this.rememberUpgrade = opts.rememberUpgrade || false;
  this.binaryType = null;
  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;

  // SSL options for Node.js client
  this.pfx = opts.pfx || null;
  this.key = opts.key || null;
  this.passphrase = opts.passphrase || null;
  this.cert = opts.cert || null;
  this.ca = opts.ca || null;
  this.ciphers = opts.ciphers || null;
  this.rejectUnauthorized = opts.rejectUnauthorized || null;

  this.open();
}

Socket.priorWebsocketSuccess = false;

/**
 * Mix in `Emitter`.
 */

Emitter(Socket.prototype);

/**
 * Protocol version.
 *
 * @api public
 */

Socket.protocol = parser.protocol; // this is an int

/**
 * Expose deps for legacy compatibility
 * and standalone browser access.
 */

Socket.Socket = Socket;
Socket.Transport = require('./transport');
Socket.transports = require('./transports');
Socket.parser = require('engine.io-parser');

/**
 * Creates transport of the given type.
 *
 * @param {String} transport name
 * @return {Transport}
 * @api private
 */

Socket.prototype.createTransport = function (name) {
  debug('creating transport "%s"', name);
  var query = clone(this.query);

  // append engine.io protocol identifier
  query.EIO = parser.protocol;

  // transport name
  query.transport = name;

  // session id if we already have one
  if (this.id) query.sid = this.id;

  var transport = new transports[name]({
    agent: this.agent,
    hostname: this.hostname,
    port: this.port,
    secure: this.secure,
    path: this.path,
    query: query,
    forceJSONP: this.forceJSONP,
    jsonp: this.jsonp,
    forceBase64: this.forceBase64,
    enablesXDR: this.enablesXDR,
    timestampRequests: this.timestampRequests,
    timestampParam: this.timestampParam,
    policyPort: this.policyPort,
    socket: this,
    pfx: this.pfx,
    key: this.key,
    passphrase: this.passphrase,
    cert: this.cert,
    ca: this.ca,
    ciphers: this.ciphers,
    rejectUnauthorized: this.rejectUnauthorized
  });

  return transport;
};

function clone (obj) {
  var o = {};
  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      o[i] = obj[i];
    }
  }
  return o;
}

/**
 * Initializes transport to use and starts probe.
 *
 * @api private
 */
Socket.prototype.open = function () {
  var transport;
  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') != -1) {
    transport = 'websocket';
  } else if (0 == this.transports.length) {
    // Emit error on next tick so it can be listened to
    var self = this;
    setTimeout(function() {
      self.emit('error', 'No transports available');
    }, 0);
    return;
  } else {
    transport = this.transports[0];
  }
  this.readyState = 'opening';

  // Retry with the next transport if the transport is disabled (jsonp: false)
  var transport;
  try {
    transport = this.createTransport(transport);
  } catch (e) {
    this.transports.shift();
    this.open();
    return;
  }

  transport.open();
  this.setTransport(transport);
};

/**
 * Sets the current transport. Disables the existing one (if any).
 *
 * @api private
 */

Socket.prototype.setTransport = function(transport){
  debug('setting transport %s', transport.name);
  var self = this;

  if (this.transport) {
    debug('clearing existing transport %s', this.transport.name);
    this.transport.removeAllListeners();
  }

  // set up transport
  this.transport = transport;

  // set up transport listeners
  transport
  .on('drain', function(){
    self.onDrain();
  })
  .on('packet', function(packet){
    self.onPacket(packet);
  })
  .on('error', function(e){
    self.onError(e);
  })
  .on('close', function(){
    self.onClose('transport close');
  });
};

/**
 * Probes a transport.
 *
 * @param {String} transport name
 * @api private
 */

Socket.prototype.probe = function (name) {
  debug('probing transport "%s"', name);
  var transport = this.createTransport(name, { probe: 1 })
    , failed = false
    , self = this;

  Socket.priorWebsocketSuccess = false;

  function onTransportOpen(){
    if (self.onlyBinaryUpgrades) {
      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
      failed = failed || upgradeLosesBinary;
    }
    if (failed) return;

    debug('probe transport "%s" opened', name);
    transport.send([{ type: 'ping', data: 'probe' }]);
    transport.once('packet', function (msg) {
      if (failed) return;
      if ('pong' == msg.type && 'probe' == msg.data) {
        debug('probe transport "%s" pong', name);
        self.upgrading = true;
        self.emit('upgrading', transport);
        if (!transport) return;
        Socket.priorWebsocketSuccess = 'websocket' == transport.name;

        debug('pausing current transport "%s"', self.transport.name);
        self.transport.pause(function () {
          if (failed) return;
          if ('closed' == self.readyState) return;
          debug('changing transport and sending upgrade packet');

          cleanup();

          self.setTransport(transport);
          transport.send([{ type: 'upgrade' }]);
          self.emit('upgrade', transport);
          transport = null;
          self.upgrading = false;
          self.flush();
        });
      } else {
        debug('probe transport "%s" failed', name);
        var err = new Error('probe error');
        err.transport = transport.name;
        self.emit('upgradeError', err);
      }
    });
  }

  function freezeTransport() {
    if (failed) return;

    // Any callback called by transport should be ignored since now
    failed = true;

    cleanup();

    transport.close();
    transport = null;
  }

  //Handle any error that happens while probing
  function onerror(err) {
    var error = new Error('probe error: ' + err);
    error.transport = transport.name;

    freezeTransport();

    debug('probe transport "%s" failed because of error: %s', name, err);

    self.emit('upgradeError', error);
  }

  function onTransportClose(){
    onerror("transport closed");
  }

  //When the socket is closed while we're probing
  function onclose(){
    onerror("socket closed");
  }

  //When the socket is upgraded while we're probing
  function onupgrade(to){
    if (transport && to.name != transport.name) {
      debug('"%s" works - aborting "%s"', to.name, transport.name);
      freezeTransport();
    }
  }

  //Remove all listeners on the transport and on self
  function cleanup(){
    transport.removeListener('open', onTransportOpen);
    transport.removeListener('error', onerror);
    transport.removeListener('close', onTransportClose);
    self.removeListener('close', onclose);
    self.removeListener('upgrading', onupgrade);
  }

  transport.once('open', onTransportOpen);
  transport.once('error', onerror);
  transport.once('close', onTransportClose);

  this.once('close', onclose);
  this.once('upgrading', onupgrade);

  transport.open();

};

/**
 * Called when connection is deemed open.
 *
 * @api public
 */

Socket.prototype.onOpen = function () {
  debug('socket open');
  this.readyState = 'open';
  Socket.priorWebsocketSuccess = 'websocket' == this.transport.name;
  this.emit('open');
  this.flush();

  // we check for `readyState` in case an `open`
  // listener already closed the socket
  if ('open' == this.readyState && this.upgrade && this.transport.pause) {
    debug('starting upgrade probes');
    for (var i = 0, l = this.upgrades.length; i < l; i++) {
      this.probe(this.upgrades[i]);
    }
  }
};

/**
 * Handles a packet.
 *
 * @api private
 */

Socket.prototype.onPacket = function (packet) {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);

    this.emit('packet', packet);

    // Socket is live - any packet counts
    this.emit('heartbeat');

    switch (packet.type) {
      case 'open':
        this.onHandshake(parsejson(packet.data));
        break;

      case 'pong':
        this.setPing();
        break;

      case 'error':
        var err = new Error('server error');
        err.code = packet.data;
        this.emit('error', err);
        break;

      case 'message':
        this.emit('data', packet.data);
        this.emit('message', packet.data);
        break;
    }
  } else {
    debug('packet received with socket readyState "%s"', this.readyState);
  }
};

/**
 * Called upon handshake completion.
 *
 * @param {Object} handshake obj
 * @api private
 */

Socket.prototype.onHandshake = function (data) {
  this.emit('handshake', data);
  this.id = data.sid;
  this.transport.query.sid = data.sid;
  this.upgrades = this.filterUpgrades(data.upgrades);
  this.pingInterval = data.pingInterval;
  this.pingTimeout = data.pingTimeout;
  this.onOpen();
  // In case open handler closes socket
  if  ('closed' == this.readyState) return;
  this.setPing();

  // Prolong liveness of socket on heartbeat
  this.removeListener('heartbeat', this.onHeartbeat);
  this.on('heartbeat', this.onHeartbeat);
};

/**
 * Resets ping timeout.
 *
 * @api private
 */

Socket.prototype.onHeartbeat = function (timeout) {
  clearTimeout(this.pingTimeoutTimer);
  var self = this;
  self.pingTimeoutTimer = setTimeout(function () {
    if ('closed' == self.readyState) return;
    self.onClose('ping timeout');
  }, timeout || (self.pingInterval + self.pingTimeout));
};

/**
 * Pings server every `this.pingInterval` and expects response
 * within `this.pingTimeout` or closes connection.
 *
 * @api private
 */

Socket.prototype.setPing = function () {
  var self = this;
  clearTimeout(self.pingIntervalTimer);
  self.pingIntervalTimer = setTimeout(function () {
    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
    self.ping();
    self.onHeartbeat(self.pingTimeout);
  }, self.pingInterval);
};

/**
* Sends a ping packet.
*
* @api public
*/

Socket.prototype.ping = function () {
  this.sendPacket('ping');
};

/**
 * Called on `drain` event
 *
 * @api private
 */

Socket.prototype.onDrain = function() {
  for (var i = 0; i < this.prevBufferLen; i++) {
    if (this.callbackBuffer[i]) {
      this.callbackBuffer[i]();
    }
  }

  this.writeBuffer.splice(0, this.prevBufferLen);
  this.callbackBuffer.splice(0, this.prevBufferLen);

  // setting prevBufferLen = 0 is very important
  // for example, when upgrading, upgrade packet is sent over,
  // and a nonzero prevBufferLen could cause problems on `drain`
  this.prevBufferLen = 0;

  if (this.writeBuffer.length == 0) {
    this.emit('drain');
  } else {
    this.flush();
  }
};

/**
 * Flush write buffers.
 *
 * @api private
 */

Socket.prototype.flush = function () {
  if ('closed' != this.readyState && this.transport.writable &&
    !this.upgrading && this.writeBuffer.length) {
    debug('flushing %d packets in socket', this.writeBuffer.length);
    this.transport.send(this.writeBuffer);
    // keep track of current length of writeBuffer
    // splice writeBuffer and callbackBuffer on `drain`
    this.prevBufferLen = this.writeBuffer.length;
    this.emit('flush');
  }
};

/**
 * Sends a message.
 *
 * @param {String} message.
 * @param {Function} callback function.
 * @return {Socket} for chaining.
 * @api public
 */

Socket.prototype.write =
Socket.prototype.send = function (msg, fn) {
  this.sendPacket('message', msg, fn);
  return this;
};

/**
 * Sends a packet.
 *
 * @param {String} packet type.
 * @param {String} data.
 * @param {Function} callback function.
 * @api private
 */

Socket.prototype.sendPacket = function (type, data, fn) {
  if ('closing' == this.readyState || 'closed' == this.readyState) {
    return;
  }

  var packet = { type: type, data: data };
  this.emit('packetCreate', packet);
  this.writeBuffer.push(packet);
  this.callbackBuffer.push(fn);
  this.flush();
};

/**
 * Closes the connection.
 *
 * @api private
 */

Socket.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.readyState = 'closing';

    var self = this;

    function close() {
      self.onClose('forced close');
      debug('socket closing - telling transport to close');
      self.transport.close();
    }

    function cleanupAndClose() {
      self.removeListener('upgrade', cleanupAndClose);
      self.removeListener('upgradeError', cleanupAndClose);
      close();
    }

    function waitForUpgrade() {
      // wait for upgrade to finish since we can't send packets while pausing a transport
      self.once('upgrade', cleanupAndClose);
      self.once('upgradeError', cleanupAndClose);
    }

    if (this.writeBuffer.length) {
      this.once('drain', function() {
        if (this.upgrading) {
          waitForUpgrade();
        } else {
          close();
        }
      });
    } else if (this.upgrading) {
      waitForUpgrade();
    } else {
      close();
    }
  }

  return this;
};

/**
 * Called upon transport error
 *
 * @api private
 */

Socket.prototype.onError = function (err) {
  debug('socket error %j', err);
  Socket.priorWebsocketSuccess = false;
  this.emit('error', err);
  this.onClose('transport error', err);
};

/**
 * Called upon transport close.
 *
 * @api private
 */

Socket.prototype.onClose = function (reason, desc) {
  if ('opening' == this.readyState || 'open' == this.readyState || 'closing' == this.readyState) {
    debug('socket close with reason: "%s"', reason);
    var self = this;

    // clear timers
    clearTimeout(this.pingIntervalTimer);
    clearTimeout(this.pingTimeoutTimer);

    // clean buffers in next tick, so developers can still
    // grab the buffers on `close` event
    setTimeout(function() {
      self.writeBuffer = [];
      self.callbackBuffer = [];
      self.prevBufferLen = 0;
    }, 0);

    // stop event from firing again for transport
    this.transport.removeAllListeners('close');

    // ensure transport won't stay open
    this.transport.close();

    // ignore further transport communication
    this.transport.removeAllListeners();

    // set ready state
    this.readyState = 'closed';

    // clear session id
    this.id = null;

    // emit close event
    this.emit('close', reason, desc);
  }
};

/**
 * Filters upgrades, returning only those matching client transports.
 *
 * @param {Array} server upgrades
 * @api private
 *
 */

Socket.prototype.filterUpgrades = function (upgrades) {
  var filteredUpgrades = [];
  for (var i = 0, j = upgrades.length; i<j; i++) {
    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
  }
  return filteredUpgrades;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./transport":44,"./transports":45,"component-emitter":51,"debug":53,"engine.io-parser":56,"indexof":67,"parsejson":68,"parseqs":69,"parseuri":70}],44:[function(require,module,exports){
/**
 * Module dependencies.
 */

var parser = require('engine.io-parser');
var Emitter = require('component-emitter');

/**
 * Module exports.
 */

module.exports = Transport;

/**
 * Transport abstract constructor.
 *
 * @param {Object} options.
 * @api private
 */

function Transport (opts) {
  this.path = opts.path;
  this.hostname = opts.hostname;
  this.port = opts.port;
  this.secure = opts.secure;
  this.query = opts.query;
  this.timestampParam = opts.timestampParam;
  this.timestampRequests = opts.timestampRequests;
  this.readyState = '';
  this.agent = opts.agent || false;
  this.socket = opts.socket;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;
}

/**
 * Mix in `Emitter`.
 */

Emitter(Transport.prototype);

/**
 * A counter used to prevent collisions in the timestamps used
 * for cache busting.
 */

Transport.timestamps = 0;

/**
 * Emits an error.
 *
 * @param {String} str
 * @return {Transport} for chaining
 * @api public
 */

Transport.prototype.onError = function (msg, desc) {
  var err = new Error(msg);
  err.type = 'TransportError';
  err.description = desc;
  this.emit('error', err);
  return this;
};

/**
 * Opens the transport.
 *
 * @api public
 */

Transport.prototype.open = function () {
  if ('closed' == this.readyState || '' == this.readyState) {
    this.readyState = 'opening';
    this.doOpen();
  }

  return this;
};

/**
 * Closes the transport.
 *
 * @api private
 */

Transport.prototype.close = function () {
  if ('opening' == this.readyState || 'open' == this.readyState) {
    this.doClose();
    this.onClose();
  }

  return this;
};

/**
 * Sends multiple packets.
 *
 * @param {Array} packets
 * @api private
 */

Transport.prototype.send = function(packets){
  if ('open' == this.readyState) {
    this.write(packets);
  } else {
    throw new Error('Transport not open');
  }
};

/**
 * Called upon open
 *
 * @api private
 */

Transport.prototype.onOpen = function () {
  this.readyState = 'open';
  this.writable = true;
  this.emit('open');
};

/**
 * Called with data.
 *
 * @param {String} data
 * @api private
 */

Transport.prototype.onData = function(data){
  var packet = parser.decodePacket(data, this.socket.binaryType);
  this.onPacket(packet);
};

/**
 * Called with a decoded packet.
 */

Transport.prototype.onPacket = function (packet) {
  this.emit('packet', packet);
};

/**
 * Called upon close.
 *
 * @api private
 */

Transport.prototype.onClose = function () {
  this.readyState = 'closed';
  this.emit('close');
};

},{"component-emitter":51,"engine.io-parser":56}],45:[function(require,module,exports){
(function (global){
/**
 * Module dependencies
 */

var XMLHttpRequest = require('xmlhttprequest');
var XHR = require('./polling-xhr');
var JSONP = require('./polling-jsonp');
var websocket = require('./websocket');

/**
 * Export transports.
 */

exports.polling = polling;
exports.websocket = websocket;

/**
 * Polling transport polymorphic constructor.
 * Decides on xhr vs jsonp based on feature detection.
 *
 * @api private
 */

function polling(opts){
  var xhr;
  var xd = false;
  var xs = false;
  var jsonp = false !== opts.jsonp;

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    xd = opts.hostname != location.hostname || port != opts.port;
    xs = opts.secure != isSSL;
  }

  opts.xdomain = xd;
  opts.xscheme = xs;
  xhr = new XMLHttpRequest(opts);

  if ('open' in xhr && !opts.forceJSONP) {
    return new XHR(opts);
  } else {
    if (!jsonp) throw new Error('JSONP disabled');
    return new JSONP(opts);
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling-jsonp":46,"./polling-xhr":47,"./websocket":49,"xmlhttprequest":50}],46:[function(require,module,exports){
(function (global){

/**
 * Module requirements.
 */

var Polling = require('./polling');
var inherit = require('component-inherit');

/**
 * Module exports.
 */

module.exports = JSONPPolling;

/**
 * Cached regular expressions.
 */

var rNewline = /\n/g;
var rEscapedNewline = /\\n/g;

/**
 * Global JSONP callbacks.
 */

var callbacks;

/**
 * Callbacks count.
 */

var index = 0;

/**
 * Noop.
 */

function empty () { }

/**
 * JSONP Polling constructor.
 *
 * @param {Object} opts.
 * @api public
 */

function JSONPPolling (opts) {
  Polling.call(this, opts);

  this.query = this.query || {};

  // define global callbacks array if not present
  // we do this here (lazily) to avoid unneeded global pollution
  if (!callbacks) {
    // we need to consider multiple engines in the same page
    if (!global.___eio) global.___eio = [];
    callbacks = global.___eio;
  }

  // callback identifier
  this.index = callbacks.length;

  // add callback to jsonp global
  var self = this;
  callbacks.push(function (msg) {
    self.onData(msg);
  });

  // append to query string
  this.query.j = this.index;

  // prevent spurious errors from being emitted when the window is unloaded
  if (global.document && global.addEventListener) {
    global.addEventListener('beforeunload', function () {
      if (self.script) self.script.onerror = empty;
    }, false);
  }
}

/**
 * Inherits from Polling.
 */

inherit(JSONPPolling, Polling);

/*
 * JSONP only supports binary as base64 encoded strings
 */

JSONPPolling.prototype.supportsBinary = false;

/**
 * Closes the socket.
 *
 * @api private
 */

JSONPPolling.prototype.doClose = function () {
  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  if (this.form) {
    this.form.parentNode.removeChild(this.form);
    this.form = null;
    this.iframe = null;
  }

  Polling.prototype.doClose.call(this);
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

JSONPPolling.prototype.doPoll = function () {
  var self = this;
  var script = document.createElement('script');

  if (this.script) {
    this.script.parentNode.removeChild(this.script);
    this.script = null;
  }

  script.async = true;
  script.src = this.uri();
  script.onerror = function(e){
    self.onError('jsonp poll error',e);
  };

  var insertAt = document.getElementsByTagName('script')[0];
  insertAt.parentNode.insertBefore(script, insertAt);
  this.script = script;

  var isUAgecko = 'undefined' != typeof navigator && /gecko/i.test(navigator.userAgent);
  
  if (isUAgecko) {
    setTimeout(function () {
      var iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      document.body.removeChild(iframe);
    }, 100);
  }
};

/**
 * Writes with a hidden iframe.
 *
 * @param {String} data to send
 * @param {Function} called upon flush.
 * @api private
 */

JSONPPolling.prototype.doWrite = function (data, fn) {
  var self = this;

  if (!this.form) {
    var form = document.createElement('form');
    var area = document.createElement('textarea');
    var id = this.iframeId = 'eio_iframe_' + this.index;
    var iframe;

    form.className = 'socketio';
    form.style.position = 'absolute';
    form.style.top = '-1000px';
    form.style.left = '-1000px';
    form.target = id;
    form.method = 'POST';
    form.setAttribute('accept-charset', 'utf-8');
    area.name = 'd';
    form.appendChild(area);
    document.body.appendChild(form);

    this.form = form;
    this.area = area;
  }

  this.form.action = this.uri();

  function complete () {
    initIframe();
    fn();
  }

  function initIframe () {
    if (self.iframe) {
      try {
        self.form.removeChild(self.iframe);
      } catch (e) {
        self.onError('jsonp polling iframe removal error', e);
      }
    }

    try {
      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
      var html = '<iframe src="javascript:0" name="'+ self.iframeId +'">';
      iframe = document.createElement(html);
    } catch (e) {
      iframe = document.createElement('iframe');
      iframe.name = self.iframeId;
      iframe.src = 'javascript:0';
    }

    iframe.id = self.iframeId;

    self.form.appendChild(iframe);
    self.iframe = iframe;
  }

  initIframe();

  // escape \n to prevent it from being converted into \r\n by some UAs
  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
  data = data.replace(rEscapedNewline, '\\\n');
  this.area.value = data.replace(rNewline, '\\n');

  try {
    this.form.submit();
  } catch(e) {}

  if (this.iframe.attachEvent) {
    this.iframe.onreadystatechange = function(){
      if (self.iframe.readyState == 'complete') {
        complete();
      }
    };
  } else {
    this.iframe.onload = complete;
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":48,"component-inherit":52}],47:[function(require,module,exports){
(function (global){
/**
 * Module requirements.
 */

var XMLHttpRequest = require('xmlhttprequest');
var Polling = require('./polling');
var Emitter = require('component-emitter');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:polling-xhr');

/**
 * Module exports.
 */

module.exports = XHR;
module.exports.Request = Request;

/**
 * Empty function
 */

function empty(){}

/**
 * XHR Polling constructor.
 *
 * @param {Object} opts
 * @api public
 */

function XHR(opts){
  Polling.call(this, opts);

  if (global.location) {
    var isSSL = 'https:' == location.protocol;
    var port = location.port;

    // some user agents have empty `location.port`
    if (!port) {
      port = isSSL ? 443 : 80;
    }

    this.xd = opts.hostname != global.location.hostname ||
      port != opts.port;
    this.xs = opts.secure != isSSL;
  }
}

/**
 * Inherits from Polling.
 */

inherit(XHR, Polling);

/**
 * XHR supports binary
 */

XHR.prototype.supportsBinary = true;

/**
 * Creates a request.
 *
 * @param {String} method
 * @api private
 */

XHR.prototype.request = function(opts){
  opts = opts || {};
  opts.uri = this.uri();
  opts.xd = this.xd;
  opts.xs = this.xs;
  opts.agent = this.agent || false;
  opts.supportsBinary = this.supportsBinary;
  opts.enablesXDR = this.enablesXDR;

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  return new Request(opts);
};

/**
 * Sends data.
 *
 * @param {String} data to send.
 * @param {Function} called upon flush.
 * @api private
 */

XHR.prototype.doWrite = function(data, fn){
  var isBinary = typeof data !== 'string' && data !== undefined;
  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
  var self = this;
  req.on('success', fn);
  req.on('error', function(err){
    self.onError('xhr post error', err);
  });
  this.sendXhr = req;
};

/**
 * Starts a poll cycle.
 *
 * @api private
 */

XHR.prototype.doPoll = function(){
  debug('xhr poll');
  var req = this.request();
  var self = this;
  req.on('data', function(data){
    self.onData(data);
  });
  req.on('error', function(err){
    self.onError('xhr poll error', err);
  });
  this.pollXhr = req;
};

/**
 * Request constructor
 *
 * @param {Object} options
 * @api public
 */

function Request(opts){
  this.method = opts.method || 'GET';
  this.uri = opts.uri;
  this.xd = !!opts.xd;
  this.xs = !!opts.xs;
  this.async = false !== opts.async;
  this.data = undefined != opts.data ? opts.data : null;
  this.agent = opts.agent;
  this.isBinary = opts.isBinary;
  this.supportsBinary = opts.supportsBinary;
  this.enablesXDR = opts.enablesXDR;

  // SSL options for Node.js client
  this.pfx = opts.pfx;
  this.key = opts.key;
  this.passphrase = opts.passphrase;
  this.cert = opts.cert;
  this.ca = opts.ca;
  this.ciphers = opts.ciphers;
  this.rejectUnauthorized = opts.rejectUnauthorized;

  this.create();
}

/**
 * Mix in `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Creates the XHR object and sends the request.
 *
 * @api private
 */

Request.prototype.create = function(){
  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  var xhr = this.xhr = new XMLHttpRequest(opts);
  var self = this;

  try {
    debug('xhr open %s: %s', this.method, this.uri);
    xhr.open(this.method, this.uri, this.async);
    if (this.supportsBinary) {
      // This has to be done after open because Firefox is stupid
      // http://stackoverflow.com/questions/13216903/get-binary-data-with-xmlhttprequest-in-a-firefox-extension
      xhr.responseType = 'arraybuffer';
    }

    if ('POST' == this.method) {
      try {
        if (this.isBinary) {
          xhr.setRequestHeader('Content-type', 'application/octet-stream');
        } else {
          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        }
      } catch (e) {}
    }

    // ie6 check
    if ('withCredentials' in xhr) {
      xhr.withCredentials = true;
    }

    if (this.hasXDR()) {
      xhr.onload = function(){
        self.onLoad();
      };
      xhr.onerror = function(){
        self.onError(xhr.responseText);
      };
    } else {
      xhr.onreadystatechange = function(){
        if (4 != xhr.readyState) return;
        if (200 == xhr.status || 1223 == xhr.status) {
          self.onLoad();
        } else {
          // make sure the `error` event handler that's user-set
          // does not throw in the same tick and gets caught here
          setTimeout(function(){
            self.onError(xhr.status);
          }, 0);
        }
      };
    }

    debug('xhr data %s', this.data);
    xhr.send(this.data);
  } catch (e) {
    // Need to defer since .create() is called directly fhrom the constructor
    // and thus the 'error' event can only be only bound *after* this exception
    // occurs.  Therefore, also, we cannot throw here at all.
    setTimeout(function() {
      self.onError(e);
    }, 0);
    return;
  }

  if (global.document) {
    this.index = Request.requestsCount++;
    Request.requests[this.index] = this;
  }
};

/**
 * Called upon successful response.
 *
 * @api private
 */

Request.prototype.onSuccess = function(){
  this.emit('success');
  this.cleanup();
};

/**
 * Called if we have data.
 *
 * @api private
 */

Request.prototype.onData = function(data){
  this.emit('data', data);
  this.onSuccess();
};

/**
 * Called upon error.
 *
 * @api private
 */

Request.prototype.onError = function(err){
  this.emit('error', err);
  this.cleanup(true);
};

/**
 * Cleans up house.
 *
 * @api private
 */

Request.prototype.cleanup = function(fromError){
  if ('undefined' == typeof this.xhr || null === this.xhr) {
    return;
  }
  // xmlhttprequest
  if (this.hasXDR()) {
    this.xhr.onload = this.xhr.onerror = empty;
  } else {
    this.xhr.onreadystatechange = empty;
  }

  if (fromError) {
    try {
      this.xhr.abort();
    } catch(e) {}
  }

  if (global.document) {
    delete Request.requests[this.index];
  }

  this.xhr = null;
};

/**
 * Called upon load.
 *
 * @api private
 */

Request.prototype.onLoad = function(){
  var data;
  try {
    var contentType;
    try {
      contentType = this.xhr.getResponseHeader('Content-Type').split(';')[0];
    } catch (e) {}
    if (contentType === 'application/octet-stream') {
      data = this.xhr.response;
    } else {
      if (!this.supportsBinary) {
        data = this.xhr.responseText;
      } else {
        data = 'ok';
      }
    }
  } catch (e) {
    this.onError(e);
  }
  if (null != data) {
    this.onData(data);
  }
};

/**
 * Check if it has XDomainRequest.
 *
 * @api private
 */

Request.prototype.hasXDR = function(){
  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
};

/**
 * Aborts the request.
 *
 * @api public
 */

Request.prototype.abort = function(){
  this.cleanup();
};

/**
 * Aborts pending requests when unloading the window. This is needed to prevent
 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
 * emitted.
 */

if (global.document) {
  Request.requestsCount = 0;
  Request.requests = {};
  if (global.attachEvent) {
    global.attachEvent('onunload', unloadHandler);
  } else if (global.addEventListener) {
    global.addEventListener('beforeunload', unloadHandler, false);
  }
}

function unloadHandler() {
  for (var i in Request.requests) {
    if (Request.requests.hasOwnProperty(i)) {
      Request.requests[i].abort();
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./polling":48,"component-emitter":51,"component-inherit":52,"debug":53,"xmlhttprequest":50}],48:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parseqs = require('parseqs');
var parser = require('engine.io-parser');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:polling');

/**
 * Module exports.
 */

module.exports = Polling;

/**
 * Is XHR2 supported?
 */

var hasXHR2 = (function() {
  var XMLHttpRequest = require('xmlhttprequest');
  var xhr = new XMLHttpRequest({ xdomain: false });
  return null != xhr.responseType;
})();

/**
 * Polling interface.
 *
 * @param {Object} opts
 * @api private
 */

function Polling(opts){
  var forceBase64 = (opts && opts.forceBase64);
  if (!hasXHR2 || forceBase64) {
    this.supportsBinary = false;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(Polling, Transport);

/**
 * Transport name.
 */

Polling.prototype.name = 'polling';

/**
 * Opens the socket (triggers polling). We write a PING message to determine
 * when the transport is open.
 *
 * @api private
 */

Polling.prototype.doOpen = function(){
  this.poll();
};

/**
 * Pauses polling.
 *
 * @param {Function} callback upon buffers are flushed and transport is paused
 * @api private
 */

Polling.prototype.pause = function(onPause){
  var pending = 0;
  var self = this;

  this.readyState = 'pausing';

  function pause(){
    debug('paused');
    self.readyState = 'paused';
    onPause();
  }

  if (this.polling || !this.writable) {
    var total = 0;

    if (this.polling) {
      debug('we are currently polling - waiting to pause');
      total++;
      this.once('pollComplete', function(){
        debug('pre-pause polling complete');
        --total || pause();
      });
    }

    if (!this.writable) {
      debug('we are currently writing - waiting to pause');
      total++;
      this.once('drain', function(){
        debug('pre-pause writing complete');
        --total || pause();
      });
    }
  } else {
    pause();
  }
};

/**
 * Starts polling cycle.
 *
 * @api public
 */

Polling.prototype.poll = function(){
  debug('polling');
  this.polling = true;
  this.doPoll();
  this.emit('poll');
};

/**
 * Overloads onData to detect payloads.
 *
 * @api private
 */

Polling.prototype.onData = function(data){
  var self = this;
  debug('polling got data %s', data);
  var callback = function(packet, index, total) {
    // if its the first message we consider the transport open
    if ('opening' == self.readyState) {
      self.onOpen();
    }

    // if its a close packet, we close the ongoing requests
    if ('close' == packet.type) {
      self.onClose();
      return false;
    }

    // otherwise bypass onData and handle the message
    self.onPacket(packet);
  };

  // decode payload
  parser.decodePayload(data, this.socket.binaryType, callback);

  // if an event did not trigger closing
  if ('closed' != this.readyState) {
    // if we got data we're not polling
    this.polling = false;
    this.emit('pollComplete');

    if ('open' == this.readyState) {
      this.poll();
    } else {
      debug('ignoring poll - transport state "%s"', this.readyState);
    }
  }
};

/**
 * For polling, send a close packet.
 *
 * @api private
 */

Polling.prototype.doClose = function(){
  var self = this;

  function close(){
    debug('writing close packet');
    self.write([{ type: 'close' }]);
  }

  if ('open' == this.readyState) {
    debug('transport open - closing');
    close();
  } else {
    // in case we're trying to close while
    // handshaking is in progress (GH-164)
    debug('transport not open - deferring close');
    this.once('open', close);
  }
};

/**
 * Writes a packets payload.
 *
 * @param {Array} data packets
 * @param {Function} drain callback
 * @api private
 */

Polling.prototype.write = function(packets){
  var self = this;
  this.writable = false;
  var callbackfn = function() {
    self.writable = true;
    self.emit('drain');
  };

  var self = this;
  parser.encodePayload(packets, this.supportsBinary, function(data) {
    self.doWrite(data, callbackfn);
  });
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

Polling.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'https' : 'http';
  var port = '';

  // cache busting is forced
  if (false !== this.timestampRequests) {
    query[this.timestampParam] = +new Date + '-' + Transport.timestamps++;
  }

  if (!this.supportsBinary && !query.sid) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // avoid port if default for schema
  if (this.port && (('https' == schema && this.port != 443) ||
     ('http' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.hostname + port + this.path + query;
};

},{"../transport":44,"component-inherit":52,"debug":53,"engine.io-parser":56,"parseqs":69,"xmlhttprequest":50}],49:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Transport = require('../transport');
var parser = require('engine.io-parser');
var parseqs = require('parseqs');
var inherit = require('component-inherit');
var debug = require('debug')('engine.io-client:websocket');

/**
 * `ws` exposes a WebSocket-compatible interface in
 * Node, or the `WebSocket` or `MozWebSocket` globals
 * in the browser.
 */

var WebSocket = require('ws');

/**
 * Module exports.
 */

module.exports = WS;

/**
 * WebSocket transport constructor.
 *
 * @api {Object} connection options
 * @api public
 */

function WS(opts){
  var forceBase64 = (opts && opts.forceBase64);
  if (forceBase64) {
    this.supportsBinary = false;
  }
  Transport.call(this, opts);
}

/**
 * Inherits from Transport.
 */

inherit(WS, Transport);

/**
 * Transport name.
 *
 * @api public
 */

WS.prototype.name = 'websocket';

/*
 * WebSockets support binary
 */

WS.prototype.supportsBinary = true;

/**
 * Opens socket.
 *
 * @api private
 */

WS.prototype.doOpen = function(){
  if (!this.check()) {
    // let probe timeout
    return;
  }

  var self = this;
  var uri = this.uri();
  var protocols = void(0);
  var opts = { agent: this.agent };

  // SSL options for Node.js client
  opts.pfx = this.pfx;
  opts.key = this.key;
  opts.passphrase = this.passphrase;
  opts.cert = this.cert;
  opts.ca = this.ca;
  opts.ciphers = this.ciphers;
  opts.rejectUnauthorized = this.rejectUnauthorized;

  this.ws = new WebSocket(uri, protocols, opts);

  if (this.ws.binaryType === undefined) {
    this.supportsBinary = false;
  }

  this.ws.binaryType = 'arraybuffer';
  this.addEventListeners();
};

/**
 * Adds event listeners to the socket
 *
 * @api private
 */

WS.prototype.addEventListeners = function(){
  var self = this;

  this.ws.onopen = function(){
    self.onOpen();
  };
  this.ws.onclose = function(){
    self.onClose();
  };
  this.ws.onmessage = function(ev){
    self.onData(ev.data);
  };
  this.ws.onerror = function(e){
    self.onError('websocket error', e);
  };
};

/**
 * Override `onData` to use a timer on iOS.
 * See: https://gist.github.com/mloughran/2052006
 *
 * @api private
 */

if ('undefined' != typeof navigator
  && /iPad|iPhone|iPod/i.test(navigator.userAgent)) {
  WS.prototype.onData = function(data){
    var self = this;
    setTimeout(function(){
      Transport.prototype.onData.call(self, data);
    }, 0);
  };
}

/**
 * Writes data to socket.
 *
 * @param {Array} array of packets.
 * @api private
 */

WS.prototype.write = function(packets){
  var self = this;
  this.writable = false;
  // encodePacket efficient as it uses WS framing
  // no need for encodePayload
  for (var i = 0, l = packets.length; i < l; i++) {
    parser.encodePacket(packets[i], this.supportsBinary, function(data) {
      //Sometimes the websocket has already been closed but the browser didn't
      //have a chance of informing us about it yet, in that case send will
      //throw an error
      try {
        self.ws.send(data);
      } catch (e){
        debug('websocket closed before onclose event');
      }
    });
  }

  function ondrain() {
    self.writable = true;
    self.emit('drain');
  }
  // fake drain
  // defer to next tick to allow Socket to clear writeBuffer
  setTimeout(ondrain, 0);
};

/**
 * Called upon close
 *
 * @api private
 */

WS.prototype.onClose = function(){
  Transport.prototype.onClose.call(this);
};

/**
 * Closes socket.
 *
 * @api private
 */

WS.prototype.doClose = function(){
  if (typeof this.ws !== 'undefined') {
    this.ws.close();
  }
};

/**
 * Generates uri for connection.
 *
 * @api private
 */

WS.prototype.uri = function(){
  var query = this.query || {};
  var schema = this.secure ? 'wss' : 'ws';
  var port = '';

  // avoid port if default for schema
  if (this.port && (('wss' == schema && this.port != 443)
    || ('ws' == schema && this.port != 80))) {
    port = ':' + this.port;
  }

  // append timestamp to URI
  if (this.timestampRequests) {
    query[this.timestampParam] = +new Date;
  }

  // communicate binary support capabilities
  if (!this.supportsBinary) {
    query.b64 = 1;
  }

  query = parseqs.encode(query);

  // prepend ? to query
  if (query.length) {
    query = '?' + query;
  }

  return schema + '://' + this.hostname + port + this.path + query;
};

/**
 * Feature detection for WebSocket.
 *
 * @return {Boolean} whether this transport is available.
 * @api public
 */

WS.prototype.check = function(){
  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
};

},{"../transport":44,"component-inherit":52,"debug":53,"engine.io-parser":56,"parseqs":69,"ws":71}],50:[function(require,module,exports){
// browser shim for xmlhttprequest module
var hasCORS = require('has-cors');

module.exports = function(opts) {
  var xdomain = opts.xdomain;

  // scheme must be same when usign XDomainRequest
  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
  var xscheme = opts.xscheme;

  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
  // https://github.com/Automattic/engine.io-client/pull/217
  var enablesXDR = opts.enablesXDR;

  // XMLHttpRequest can be disabled on IE
  try {
    if ('undefined' != typeof XMLHttpRequest && (!xdomain || hasCORS)) {
      return new XMLHttpRequest();
    }
  } catch (e) { }

  // Use XDomainRequest for IE8 if enablesXDR is true
  // because loading bar keeps flashing when using jsonp-polling
  // https://github.com/yujiosaka/socke.io-ie8-loading-example
  try {
    if ('undefined' != typeof XDomainRequest && !xscheme && enablesXDR) {
      return new XDomainRequest();
    }
  } catch (e) { }

  if (!xdomain) {
    try {
      return new ActiveXObject('Microsoft.XMLHTTP');
    } catch(e) { }
  }
}

},{"has-cors":65}],51:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],52:[function(require,module,exports){

module.exports = function(a, b){
  var fn = function(){};
  fn.prototype = b.prototype;
  a.prototype = new fn;
  a.prototype.constructor = a;
};
},{}],53:[function(require,module,exports){

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // is webkit? http://stackoverflow.com/a/16459606/376773
  return ('WebkitAppearance' in document.documentElement.style) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (window.console && (console.firebug || (console.exception && console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31);
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  return JSON.stringify(v);
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs() {
  var args = arguments;
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return args;

  var c = 'color: ' + this.color;
  args = [args[0], c, 'color: inherit'].concat(Array.prototype.slice.call(args, 1));

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
  return args;
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // This hackery is required for IE8,
  // where the `console.log` function doesn't have 'apply'
  return 'object' == typeof console
    && 'function' == typeof console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      localStorage.removeItem('debug');
    } else {
      localStorage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = localStorage.debug;
  } catch(e) {}
  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

},{"./debug":54}],54:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = debug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lowercased letter, i.e. "n".
 */

exports.formatters = {};

/**
 * Previously assigned color.
 */

var prevColor = 0;

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 *
 * @return {Number}
 * @api private
 */

function selectColor() {
  return exports.colors[prevColor++ % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function debug(namespace) {

  // define the `disabled` version
  function disabled() {
  }
  disabled.enabled = false;

  // define the `enabled` version
  function enabled() {

    var self = enabled;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // add the `color` if not set
    if (null == self.useColors) self.useColors = exports.useColors();
    if (null == self.color && self.useColors) self.color = selectColor();

    var args = Array.prototype.slice.call(arguments);

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %o
      args = ['%o'].concat(args);
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    if ('function' === typeof exports.formatArgs) {
      args = exports.formatArgs.apply(self, args);
    }
    var logFn = enabled.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }
  enabled.enabled = true;

  var fn = exports.enabled(namespace) ? enabled : disabled;

  fn.namespace = namespace;

  return fn;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  var split = (namespaces || '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":55}],55:[function(require,module,exports){
module.exports=require(40)
},{"/root/wp/server/node_modules/debug/node_modules/ms/index.js":40}],56:[function(require,module,exports){
(function (global){
/**
 * Module dependencies.
 */

var keys = require('./keys');
var hasBinary = require('has-binary');
var sliceBuffer = require('arraybuffer.slice');
var base64encoder = require('base64-arraybuffer');
var after = require('after');
var utf8 = require('utf8');

/**
 * Check if we are running an android browser. That requires us to use
 * ArrayBuffer with polling transports...
 *
 * http://ghinda.net/jpeg-blob-ajax-android/
 */

var isAndroid = navigator.userAgent.match(/Android/i);

/**
 * Check if we are running in PhantomJS.
 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
 * https://github.com/ariya/phantomjs/issues/11395
 * @type boolean
 */
var isPhantomJS = /PhantomJS/i.test(navigator.userAgent);

/**
 * When true, avoids using Blobs to encode payloads.
 * @type boolean
 */
var dontSendBlobs = isAndroid || isPhantomJS;

/**
 * Current protocol version.
 */

exports.protocol = 3;

/**
 * Packet types.
 */

var packets = exports.packets = {
    open:     0    // non-ws
  , close:    1    // non-ws
  , ping:     2
  , pong:     3
  , message:  4
  , upgrade:  5
  , noop:     6
};

var packetslist = keys(packets);

/**
 * Premade error packet.
 */

var err = { type: 'error', data: 'parser error' };

/**
 * Create a blob api even for blob builder when vendor prefixes exist
 */

var Blob = require('blob');

/**
 * Encodes a packet.
 *
 *     <packet type id> [ <data> ]
 *
 * Example:
 *
 *     5hello world
 *     3
 *     4
 *
 * Binary is encoded in an identical principle
 *
 * @api private
 */

exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
  if ('function' == typeof supportsBinary) {
    callback = supportsBinary;
    supportsBinary = false;
  }

  if ('function' == typeof utf8encode) {
    callback = utf8encode;
    utf8encode = null;
  }

  var data = (packet.data === undefined)
    ? undefined
    : packet.data.buffer || packet.data;

  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
    return encodeArrayBuffer(packet, supportsBinary, callback);
  } else if (Blob && data instanceof global.Blob) {
    return encodeBlob(packet, supportsBinary, callback);
  }

  // might be an object with { base64: true, data: dataAsBase64String }
  if (data && data.base64) {
    return encodeBase64Object(packet, callback);
  }

  // Sending data as a utf-8 string
  var encoded = packets[packet.type];

  // data fragment is optional
  if (undefined !== packet.data) {
    encoded += utf8encode ? utf8.encode(String(packet.data)) : String(packet.data);
  }

  return callback('' + encoded);

};

function encodeBase64Object(packet, callback) {
  // packet data is an object { base64: true, data: dataAsBase64String }
  var message = 'b' + exports.packets[packet.type] + packet.data.data;
  return callback(message);
}

/**
 * Encode packet helpers for binary types
 */

function encodeArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var data = packet.data;
  var contentArray = new Uint8Array(data);
  var resultBuffer = new Uint8Array(1 + data.byteLength);

  resultBuffer[0] = packets[packet.type];
  for (var i = 0; i < contentArray.length; i++) {
    resultBuffer[i+1] = contentArray[i];
  }

  return callback(resultBuffer.buffer);
}

function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  var fr = new FileReader();
  fr.onload = function() {
    packet.data = fr.result;
    exports.encodePacket(packet, supportsBinary, true, callback);
  };
  return fr.readAsArrayBuffer(packet.data);
}

function encodeBlob(packet, supportsBinary, callback) {
  if (!supportsBinary) {
    return exports.encodeBase64Packet(packet, callback);
  }

  if (dontSendBlobs) {
    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
  }

  var length = new Uint8Array(1);
  length[0] = packets[packet.type];
  var blob = new Blob([length.buffer, packet.data]);

  return callback(blob);
}

/**
 * Encodes a packet with binary data in a base64 string
 *
 * @param {Object} packet, has `type` and `data`
 * @return {String} base64 encoded message
 */

exports.encodeBase64Packet = function(packet, callback) {
  var message = 'b' + exports.packets[packet.type];
  if (Blob && packet.data instanceof Blob) {
    var fr = new FileReader();
    fr.onload = function() {
      var b64 = fr.result.split(',')[1];
      callback(message + b64);
    };
    return fr.readAsDataURL(packet.data);
  }

  var b64data;
  try {
    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
  } catch (e) {
    // iPhone Safari doesn't let you apply with typed arrays
    var typed = new Uint8Array(packet.data);
    var basic = new Array(typed.length);
    for (var i = 0; i < typed.length; i++) {
      basic[i] = typed[i];
    }
    b64data = String.fromCharCode.apply(null, basic);
  }
  message += global.btoa(b64data);
  return callback(message);
};

/**
 * Decodes a packet. Changes format to Blob if requested.
 *
 * @return {Object} with `type` and `data` (if any)
 * @api private
 */

exports.decodePacket = function (data, binaryType, utf8decode) {
  // String data
  if (typeof data == 'string' || data === undefined) {
    if (data.charAt(0) == 'b') {
      return exports.decodeBase64Packet(data.substr(1), binaryType);
    }

    if (utf8decode) {
      try {
        data = utf8.decode(data);
      } catch (e) {
        return err;
      }
    }
    var type = data.charAt(0);

    if (Number(type) != type || !packetslist[type]) {
      return err;
    }

    if (data.length > 1) {
      return { type: packetslist[type], data: data.substring(1) };
    } else {
      return { type: packetslist[type] };
    }
  }

  var asArray = new Uint8Array(data);
  var type = asArray[0];
  var rest = sliceBuffer(data, 1);
  if (Blob && binaryType === 'blob') {
    rest = new Blob([rest]);
  }
  return { type: packetslist[type], data: rest };
};

/**
 * Decodes a packet encoded in a base64 string
 *
 * @param {String} base64 encoded message
 * @return {Object} with `type` and `data` (if any)
 */

exports.decodeBase64Packet = function(msg, binaryType) {
  var type = packetslist[msg.charAt(0)];
  if (!global.ArrayBuffer) {
    return { type: type, data: { base64: true, data: msg.substr(1) } };
  }

  var data = base64encoder.decode(msg.substr(1));

  if (binaryType === 'blob' && Blob) {
    data = new Blob([data]);
  }

  return { type: type, data: data };
};

/**
 * Encodes multiple messages (payload).
 *
 *     <length>:data
 *
 * Example:
 *
 *     11:hello world2:hi
 *
 * If any contents are binary, they will be encoded as base64 strings. Base64
 * encoded strings are marked with a b before the length specifier
 *
 * @param {Array} packets
 * @api private
 */

exports.encodePayload = function (packets, supportsBinary, callback) {
  if (typeof supportsBinary == 'function') {
    callback = supportsBinary;
    supportsBinary = null;
  }

  var isBinary = hasBinary(packets);

  if (supportsBinary && isBinary) {
    if (Blob && !dontSendBlobs) {
      return exports.encodePayloadAsBlob(packets, callback);
    }

    return exports.encodePayloadAsArrayBuffer(packets, callback);
  }

  if (!packets.length) {
    return callback('0:');
  }

  function setLengthHeader(message) {
    return message.length + ':' + message;
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, !isBinary ? false : supportsBinary, true, function(message) {
      doneCallback(null, setLengthHeader(message));
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(results.join(''));
  });
};

/**
 * Async array map using after
 */

function map(ary, each, done) {
  var result = new Array(ary.length);
  var next = after(ary.length, done);

  var eachWithIndex = function(i, el, cb) {
    each(el, function(error, msg) {
      result[i] = msg;
      cb(error, result);
    });
  };

  for (var i = 0; i < ary.length; i++) {
    eachWithIndex(i, ary[i], next);
  }
}

/*
 * Decodes data when a payload is maybe expected. Possible binary contents are
 * decoded from their base64 representation
 *
 * @param {String} data, callback method
 * @api public
 */

exports.decodePayload = function (data, binaryType, callback) {
  if (typeof data != 'string') {
    return exports.decodePayloadAsBinary(data, binaryType, callback);
  }

  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var packet;
  if (data == '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

  var length = ''
    , n, msg;

  for (var i = 0, l = data.length; i < l; i++) {
    var chr = data.charAt(i);

    if (':' != chr) {
      length += chr;
    } else {
      if ('' == length || (length != (n = Number(length)))) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      msg = data.substr(i + 1, n);

      if (length != msg.length) {
        // parser error - ignoring payload
        return callback(err, 0, 1);
      }

      if (msg.length) {
        packet = exports.decodePacket(msg, binaryType, true);

        if (err.type == packet.type && err.data == packet.data) {
          // parser error in individual packet - ignoring payload
          return callback(err, 0, 1);
        }

        var ret = callback(packet, i + n, l);
        if (false === ret) return;
      }

      // advance cursor
      i += n;
      length = '';
    }
  }

  if (length != '') {
    // parser error - ignoring payload
    return callback(err, 0, 1);
  }

};

/**
 * Encodes multiple messages (payload) as binary.
 *
 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
 * 255><data>
 *
 * Example:
 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
 *
 * @param {Array} packets
 * @return {ArrayBuffer} encoded payload
 * @api private
 */

exports.encodePayloadAsArrayBuffer = function(packets, callback) {
  if (!packets.length) {
    return callback(new ArrayBuffer(0));
  }

  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(data) {
      return doneCallback(null, data);
    });
  }

  map(packets, encodeOne, function(err, encodedPackets) {
    var totalLength = encodedPackets.reduce(function(acc, p) {
      var len;
      if (typeof p === 'string'){
        len = p.length;
      } else {
        len = p.byteLength;
      }
      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
    }, 0);

    var resultArray = new Uint8Array(totalLength);

    var bufferIndex = 0;
    encodedPackets.forEach(function(p) {
      var isString = typeof p === 'string';
      var ab = p;
      if (isString) {
        var view = new Uint8Array(p.length);
        for (var i = 0; i < p.length; i++) {
          view[i] = p.charCodeAt(i);
        }
        ab = view.buffer;
      }

      if (isString) { // not true binary
        resultArray[bufferIndex++] = 0;
      } else { // true binary
        resultArray[bufferIndex++] = 1;
      }

      var lenStr = ab.byteLength.toString();
      for (var i = 0; i < lenStr.length; i++) {
        resultArray[bufferIndex++] = parseInt(lenStr[i]);
      }
      resultArray[bufferIndex++] = 255;

      var view = new Uint8Array(ab);
      for (var i = 0; i < view.length; i++) {
        resultArray[bufferIndex++] = view[i];
      }
    });

    return callback(resultArray.buffer);
  });
};

/**
 * Encode as Blob
 */

exports.encodePayloadAsBlob = function(packets, callback) {
  function encodeOne(packet, doneCallback) {
    exports.encodePacket(packet, true, true, function(encoded) {
      var binaryIdentifier = new Uint8Array(1);
      binaryIdentifier[0] = 1;
      if (typeof encoded === 'string') {
        var view = new Uint8Array(encoded.length);
        for (var i = 0; i < encoded.length; i++) {
          view[i] = encoded.charCodeAt(i);
        }
        encoded = view.buffer;
        binaryIdentifier[0] = 0;
      }

      var len = (encoded instanceof ArrayBuffer)
        ? encoded.byteLength
        : encoded.size;

      var lenStr = len.toString();
      var lengthAry = new Uint8Array(lenStr.length + 1);
      for (var i = 0; i < lenStr.length; i++) {
        lengthAry[i] = parseInt(lenStr[i]);
      }
      lengthAry[lenStr.length] = 255;

      if (Blob) {
        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
        doneCallback(null, blob);
      }
    });
  }

  map(packets, encodeOne, function(err, results) {
    return callback(new Blob(results));
  });
};

/*
 * Decodes data when a payload is maybe expected. Strings are decoded by
 * interpreting each byte as a key code for entries marked to start with 0. See
 * description of encodePayloadAsBinary
 *
 * @param {ArrayBuffer} data, callback method
 * @api public
 */

exports.decodePayloadAsBinary = function (data, binaryType, callback) {
  if (typeof binaryType === 'function') {
    callback = binaryType;
    binaryType = null;
  }

  var bufferTail = data;
  var buffers = [];

  var numberTooLong = false;
  while (bufferTail.byteLength > 0) {
    var tailArray = new Uint8Array(bufferTail);
    var isString = tailArray[0] === 0;
    var msgLength = '';

    for (var i = 1; ; i++) {
      if (tailArray[i] == 255) break;

      if (msgLength.length > 310) {
        numberTooLong = true;
        break;
      }

      msgLength += tailArray[i];
    }

    if(numberTooLong) return callback(err, 0, 1);

    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
    msgLength = parseInt(msgLength);

    var msg = sliceBuffer(bufferTail, 0, msgLength);
    if (isString) {
      try {
        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
      } catch (e) {
        // iPhone Safari doesn't let you apply to typed arrays
        var typed = new Uint8Array(msg);
        msg = '';
        for (var i = 0; i < typed.length; i++) {
          msg += String.fromCharCode(typed[i]);
        }
      }
    }

    buffers.push(msg);
    bufferTail = sliceBuffer(bufferTail, msgLength);
  }

  var total = buffers.length;
  buffers.forEach(function(buffer, i) {
    callback(exports.decodePacket(buffer, binaryType, true), i, total);
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./keys":57,"after":58,"arraybuffer.slice":59,"base64-arraybuffer":60,"blob":61,"has-binary":62,"utf8":64}],57:[function(require,module,exports){

/**
 * Gets the keys for an object.
 *
 * @return {Array} keys
 * @api private
 */

module.exports = Object.keys || function keys (obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

},{}],58:[function(require,module,exports){
module.exports = after

function after(count, callback, err_cb) {
    var bail = false
    err_cb = err_cb || noop
    proxy.count = count

    return (count === 0) ? callback() : proxy

    function proxy(err, result) {
        if (proxy.count <= 0) {
            throw new Error('after called too many times')
        }
        --proxy.count

        // after first error, rest are passed to err_cb
        if (err) {
            bail = true
            callback(err)
            // future error callbacks will go to error handler
            callback = err_cb
        } else if (proxy.count === 0 && !bail) {
            callback(null, result)
        }
    }
}

function noop() {}

},{}],59:[function(require,module,exports){
/**
 * An abstraction for slicing an arraybuffer even when
 * ArrayBuffer.prototype.slice is not supported
 *
 * @api public
 */

module.exports = function(arraybuffer, start, end) {
  var bytes = arraybuffer.byteLength;
  start = start || 0;
  end = end || bytes;

  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }

  if (start < 0) { start += bytes; }
  if (end < 0) { end += bytes; }
  if (end > bytes) { end = bytes; }

  if (start >= bytes || start >= end || bytes === 0) {
    return new ArrayBuffer(0);
  }

  var abv = new Uint8Array(arraybuffer);
  var result = new Uint8Array(end - start);
  for (var i = start, ii = 0; i < end; i++, ii++) {
    result[ii] = abv[i];
  }
  return result.buffer;
};

},{}],60:[function(require,module,exports){
/*
 * base64-arraybuffer
 * https://github.com/niklasvh/base64-arraybuffer
 *
 * Copyright (c) 2012 Niklas von Hertzen
 * Licensed under the MIT license.
 */
(function(chars){
  "use strict";

  exports.encode = function(arraybuffer) {
    var bytes = new Uint8Array(arraybuffer),
    i, len = bytes.length, base64 = "";

    for (i = 0; i < len; i+=3) {
      base64 += chars[bytes[i] >> 2];
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
      base64 += chars[bytes[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
  };

  exports.decode =  function(base64) {
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i+1]);
      encoded3 = chars.indexOf(base64[i+2]);
      encoded4 = chars.indexOf(base64[i+3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
  };
})("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");

},{}],61:[function(require,module,exports){
(function (global){
/**
 * Create a blob builder even when vendor prefixes exist
 */

var BlobBuilder = global.BlobBuilder
  || global.WebKitBlobBuilder
  || global.MSBlobBuilder
  || global.MozBlobBuilder;

/**
 * Check if Blob constructor is supported
 */

var blobSupported = (function() {
  try {
    var a = new Blob(['hi']);
    return a.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if Blob constructor supports ArrayBufferViews
 * Fails in Safari 6, so we need to map to ArrayBuffers there.
 */

var blobSupportsArrayBufferView = blobSupported && (function() {
  try {
    var b = new Blob([new Uint8Array([1,2])]);
    return b.size === 2;
  } catch(e) {
    return false;
  }
})();

/**
 * Check if BlobBuilder is supported
 */

var blobBuilderSupported = BlobBuilder
  && BlobBuilder.prototype.append
  && BlobBuilder.prototype.getBlob;

/**
 * Helper function that maps ArrayBufferViews to ArrayBuffers
 * Used by BlobBuilder constructor and old browsers that didn't
 * support it in the Blob constructor.
 */

function mapArrayBufferViews(ary) {
  for (var i = 0; i < ary.length; i++) {
    var chunk = ary[i];
    if (chunk.buffer instanceof ArrayBuffer) {
      var buf = chunk.buffer;

      // if this is a subarray, make a copy so we only
      // include the subarray region from the underlying buffer
      if (chunk.byteLength !== buf.byteLength) {
        var copy = new Uint8Array(chunk.byteLength);
        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
        buf = copy.buffer;
      }

      ary[i] = buf;
    }
  }
}

function BlobBuilderConstructor(ary, options) {
  options = options || {};

  var bb = new BlobBuilder();
  mapArrayBufferViews(ary);

  for (var i = 0; i < ary.length; i++) {
    bb.append(ary[i]);
  }

  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
};

function BlobConstructor(ary, options) {
  mapArrayBufferViews(ary);
  return new Blob(ary, options || {});
};

module.exports = (function() {
  if (blobSupported) {
    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
  } else if (blobBuilderSupported) {
    return BlobBuilderConstructor;
  } else {
    return undefined;
  }
})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],62:[function(require,module,exports){
(function (global){

/*
 * Module requirements.
 */

var isArray = require('isarray');

/**
 * Module exports.
 */

module.exports = hasBinary;

/**
 * Checks for binary data.
 *
 * Right now only Buffer and ArrayBuffer are supported..
 *
 * @param {Object} anything
 * @api public
 */

function hasBinary(data) {

  function _hasBinary(obj) {
    if (!obj) return false;

    if ( (global.Buffer && global.Buffer.isBuffer(obj)) ||
         (global.ArrayBuffer && obj instanceof ArrayBuffer) ||
         (global.Blob && obj instanceof Blob) ||
         (global.File && obj instanceof File)
        ) {
      return true;
    }

    if (isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
          if (_hasBinary(obj[i])) {
              return true;
          }
      }
    } else if (obj && 'object' == typeof obj) {
      if (obj.toJSON) {
        obj = obj.toJSON();
      }

      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && _hasBinary(obj[key])) {
          return true;
        }
      }
    }

    return false;
  }

  return _hasBinary(data);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"isarray":63}],63:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],64:[function(require,module,exports){
(function (global){
/*! https://mths.be/utf8js v2.0.0 by @mathias */
;(function(root) {

	// Detect free variables `exports`
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	// Taken from https://mths.be/punycode
	function ucs2decode(string) {
		var output = [];
		var counter = 0;
		var length = string.length;
		var value;
		var extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	// Taken from https://mths.be/punycode
	function ucs2encode(array) {
		var length = array.length;
		var index = -1;
		var value;
		var output = '';
		while (++index < length) {
			value = array[index];
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
		}
		return output;
	}

	function checkScalarValue(codePoint) {
		if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
			throw Error(
				'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
				' is not a scalar value'
			);
		}
	}
	/*--------------------------------------------------------------------------*/

	function createByte(codePoint, shift) {
		return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
	}

	function encodeCodePoint(codePoint) {
		if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
			return stringFromCharCode(codePoint);
		}
		var symbol = '';
		if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
			symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
		}
		else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
			checkScalarValue(codePoint);
			symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
			symbol += createByte(codePoint, 6);
		}
		else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
			symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
			symbol += createByte(codePoint, 12);
			symbol += createByte(codePoint, 6);
		}
		symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
		return symbol;
	}

	function utf8encode(string) {
		var codePoints = ucs2decode(string);
		var length = codePoints.length;
		var index = -1;
		var codePoint;
		var byteString = '';
		while (++index < length) {
			codePoint = codePoints[index];
			byteString += encodeCodePoint(codePoint);
		}
		return byteString;
	}

	/*--------------------------------------------------------------------------*/

	function readContinuationByte() {
		if (byteIndex >= byteCount) {
			throw Error('Invalid byte index');
		}

		var continuationByte = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		if ((continuationByte & 0xC0) == 0x80) {
			return continuationByte & 0x3F;
		}

		// If we end up here, it’s not a continuation byte
		throw Error('Invalid continuation byte');
	}

	function decodeSymbol() {
		var byte1;
		var byte2;
		var byte3;
		var byte4;
		var codePoint;

		if (byteIndex > byteCount) {
			throw Error('Invalid byte index');
		}

		if (byteIndex == byteCount) {
			return false;
		}

		// Read first byte
		byte1 = byteArray[byteIndex] & 0xFF;
		byteIndex++;

		// 1-byte sequence (no continuation bytes)
		if ((byte1 & 0x80) == 0) {
			return byte1;
		}

		// 2-byte sequence
		if ((byte1 & 0xE0) == 0xC0) {
			var byte2 = readContinuationByte();
			codePoint = ((byte1 & 0x1F) << 6) | byte2;
			if (codePoint >= 0x80) {
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 3-byte sequence (may include unpaired surrogates)
		if ((byte1 & 0xF0) == 0xE0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
			if (codePoint >= 0x0800) {
				checkScalarValue(codePoint);
				return codePoint;
			} else {
				throw Error('Invalid continuation byte');
			}
		}

		// 4-byte sequence
		if ((byte1 & 0xF8) == 0xF0) {
			byte2 = readContinuationByte();
			byte3 = readContinuationByte();
			byte4 = readContinuationByte();
			codePoint = ((byte1 & 0x0F) << 0x12) | (byte2 << 0x0C) |
				(byte3 << 0x06) | byte4;
			if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
				return codePoint;
			}
		}

		throw Error('Invalid UTF-8 detected');
	}

	var byteArray;
	var byteCount;
	var byteIndex;
	function utf8decode(byteString) {
		byteArray = ucs2decode(byteString);
		byteCount = byteArray.length;
		byteIndex = 0;
		var codePoints = [];
		var tmp;
		while ((tmp = decodeSymbol()) !== false) {
			codePoints.push(tmp);
		}
		return ucs2encode(codePoints);
	}

	/*--------------------------------------------------------------------------*/

	var utf8 = {
		'version': '2.0.0',
		'encode': utf8encode,
		'decode': utf8decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
  if (freeExports && !freeExports.nodeType) {
    if (freeModule) { // in Node.js or RingoJS v0.8.0+
      freeModule.exports = utf8;
    } else { // in Narwhal or RingoJS v0.7.0-
      var object = {};
      var hasOwnProperty = object.hasOwnProperty;
      for (var key in utf8) {
        hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
      }
    }
  } else if (
    typeof define == 'function' &&
    typeof define.amd == 'object' &&
    define.amd
  ) {
    define(function() {
      return utf8;
    });
  } else { // in Rhino or a web browser
    root.utf8 = utf8;
  }

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],65:[function(require,module,exports){

/**
 * Module dependencies.
 */

var global = require('global');

/**
 * Module exports.
 *
 * Logic borrowed from Modernizr:
 *
 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
 */

try {
  module.exports = 'XMLHttpRequest' in global &&
    'withCredentials' in new global.XMLHttpRequest();
} catch (err) {
  // if XMLHttp support is disabled in IE then it will throw
  // when trying to create
  module.exports = false;
}

},{"global":66}],66:[function(require,module,exports){

/**
 * Returns `this`. Execute this without a "context" (i.e. without it being
 * attached to an object of the left-hand side), and `this` points to the
 * "global" scope of the current JS execution.
 */

module.exports = (function () { return this; })();

},{}],67:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],68:[function(require,module,exports){
(function (global){
/**
 * JSON parse.
 *
 * @see Based on jQuery#parseJSON (MIT) and JSON2
 * @api private
 */

var rvalidchars = /^[\],:{}\s]*$/;
var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
var rtrimLeft = /^\s+/;
var rtrimRight = /\s+$/;

module.exports = function parsejson(data) {
  if ('string' != typeof data || !data) {
    return null;
  }

  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');

  // Attempt to parse using the native JSON parser first
  if (global.JSON && JSON.parse) {
    return JSON.parse(data);
  }

  if (rvalidchars.test(data.replace(rvalidescape, '@')
      .replace(rvalidtokens, ']')
      .replace(rvalidbraces, ''))) {
    return (new Function('return ' + data))();
  }
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],69:[function(require,module,exports){
/**
 * Compiles a querystring
 * Returns string representation of the object
 *
 * @param {Object}
 * @api private
 */

exports.encode = function (obj) {
  var str = '';

  for (var i in obj) {
    if (obj.hasOwnProperty(i)) {
      if (str.length) str += '&';
      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
    }
  }

  return str;
};

/**
 * Parses a simple querystring into an object
 *
 * @param {String} qs
 * @api private
 */

exports.decode = function(qs){
  var qry = {};
  var pairs = qs.split('&');
  for (var i = 0, l = pairs.length; i < l; i++) {
    var pair = pairs[i].split('=');
    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return qry;
};

},{}],70:[function(require,module,exports){
/**
 * Parses an URI
 *
 * @author Steven Levithan <stevenlevithan.com> (MIT license)
 * @api private
 */

var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

var parts = [
    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
];

module.exports = function parseuri(str) {
    var src = str,
        b = str.indexOf('['),
        e = str.indexOf(']');

    if (b != -1 && e != -1) {
        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
    }

    var m = re.exec(str || ''),
        uri = {},
        i = 14;

    while (i--) {
        uri[parts[i]] = m[i] || '';
    }

    if (b != -1 && e != -1) {
        uri.source = src;
        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
        uri.ipv6uri = true;
    }

    return uri;
};

},{}],71:[function(require,module,exports){

/**
 * Module dependencies.
 */

var global = (function() { return this; })();

/**
 * WebSocket constructor.
 */

var WebSocket = global.WebSocket || global.MozWebSocket;

/**
 * Module exports.
 */

module.exports = WebSocket ? ws : null;

/**
 * WebSocket constructor.
 *
 * The third `opts` options object gets ignored in web browsers, since it's
 * non-standard, and throws a TypeError if passed to the constructor.
 * See: https://github.com/einaros/ws/issues/227
 *
 * @param {String} uri
 * @param {Array} protocols (optional)
 * @param {Object) opts (optional)
 * @api public
 */

function ws(uri, protocols, opts) {
  var instance;
  if (protocols) {
    instance = new WebSocket(uri, protocols);
  } else {
    instance = new WebSocket(uri);
  }
  return instance;
}

if (WebSocket) ws.prototype = WebSocket.prototype;

},{}],72:[function(require,module,exports){

},{}],73:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":74,"ieee754":75,"is-array":76}],74:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],75:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],76:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],77:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],78:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[28]);
