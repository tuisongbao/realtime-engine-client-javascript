
<div class="alert alert-warning">
    阅读此文档前，请先阅读 [实时引擎指南](http://www.tuisongbao.com:80/docs/engineGuide) 。
</div>

## 安装

![bower](https://img.shields.io/bower/v/tuisongbao-realtime-engine-client.svg)

从 [这里](http://www.tuisongbao.com:80/downloadSDK/engine##javascript) 下载，或者使用 bower 安装：

```bash
bower install tuisongbao-realtime-engine-client
```

然后引用安装目录下的 `engine.min.js` 或 `engine.js` 即可:

```html
<script src="/path/to/engine.min.js"></script>
```

## 浏览器兼容

兼容 IE8+ 以及各种最新版的现代浏览器，包括 Chrome 、 FireFox 、 Safari 等。

## 配置并建立连接

实例化 `Engine` 时可以通过第二个参数传递各种选项：

```js
var options = {
    // 认证用户的地址
    authEndpoint: 'http://yourdomain.com/tuisongbao_engine/auth',
    // 认证用户请求方式，默认为 `xhr` ，使用 XMLHttpRequest ，但是该方式在 IE8/9 上存在跨域问题，如果你配置的 authEndpoint 跨域并且需要支持 IE8/9 ，应使用 `jsonp` ，同时请确保你的服务端支持 `jsonp` 请求，该设置在所有浏览器上生效，并非仅在 IE8/9 上生效
    authTransport: 'jsonp',
    // 可选，如果配置，认证请求将携带该值，可以用来表明用户身份。当结合 jsonp 使用时，该值如果为 Object ，会被序列化成 JSON 字符串。
    authData: 'abcdefghijklmn'
};

var engine = new Engine('YOUR_APP_ID', options);
```

实例化后，连接将自动建立，你可以使用返回的 `Engine` 实例进行后续各种操作。

## Connection Event

在 `Engine` 实例的 `connection` 对象上，可以绑定如下 *Event* ：

- `state_changed` ：连接状态变化时触发。
- `connecting_in` ：通知下次重连是在多久以后。
- 以及 `initialized`， `connected`， `disconnected`, `connecting`, `unavailable`, `failed`，分别于 `Connection` 进入该状态时触发。
- `error` ：连接发生错误时触发。

```js
engine.connection.bind('state_changed', function (states) {
    console.log(states.previous, states.current);
});

engine.connection.bind('connecting_in', function (delay) {
    console.log('重连将在 ' + delay + 'ms 后进行');
});

engine.connection.bind('connecting', function () {
    // 提醒用户网络不稳定，正在尝试建立连接
});

engine.connection.bind('unavailable', function () {
    // 提醒用户网络不可用，请检查网络设置
});

engine.connection.bind('error', function (err) {
    console.log(err);
});
```

## 获取 SocketId

```js
engine.connection.bind('connected', function () {
    console.log(engine.connection.socketId);
});
```

## Pub/Sub

### 订阅 Channel

```js
var coolChannel = engine.subscribe('cool-channel');
```

该方法返回 `Channel` 实例，可用于 `bind` 等操作。

另外也可以通过 `Engine` 实例的 `channel` 方法获取已订阅的 `Channel` 实例:

```js
var coolChannel = engine.channel('cool-channel');
```

使用 `unsubscribe` 方法来取消订阅：

```js
engine.unsubscribe('cool-channel');
```

### 绑定 Event 处理函数

```js
coolChannel.bind('cool-event', function (data) {
    // 处理逻辑
});
```

该操作只应用于当前 `Channel`，也就是说你可以在其他 `Channel` 上使用相同的 `Event` 名字。

使用 `unbind` 方法来解除绑定：

```js
// 只解绑这个 Event 的某个处理函数
coolChannel.unbind('cool-channel', handler);
// 解绑这个 Event 的所有处理函数
coolChannel.unbind('cool-channel');
```

### Channel Event

对于 *Private Channel* 和 *Presence Channel* ，可以通过绑定 `engine:subscription_succeeded` 和 `engine:subscription_error` `Event` 来处理订阅结果：

```js
privateChannel.bind('engine:subscription_succeeded', function () {
    console.log('订阅 channel ' + privateChannel.name + ' 成功');
});

privateChannel.bind('engine:subscription_error', function (err) {
    console.log('订阅 channel ' + privateChannel.name + ' 失败', err);
    // 重新 subscribe ?
});
```

对于 *Presence Channel* , `engine:subscription_succeeded` 处理函数将得到一个额外的参数 `users` ，该对象具有以下属性：

```js
{
    // 该 Channel 上的当前在线用户数
    count: 100,
    // 接收一个方法作为参数，用来遍历当前在线用户
    each: [Function],
    // 当前用户
    me: {
        userId: '1111',
        userInfo: {}
    }
}
```

示例如下：

```js
presenceChannel.bind('engine:subscription_succeeded', function (users) {
    console.log('订阅 channel ' + presenceChannel.name + ' 成功');
    console.log('用户量 ' + users.count);
    
    console.log('遍历用户开始：');
    users.each(function (user) {
        console.log(user.id, user.info);
    });
    console.log('遍历用户结束');

    console.log('当前用户：', users.me.id, users.me.info);
});
```

注意， `users` 对象也可以直接从 *Presence Channel* 对象上获取：

```js
console.log(presenceChannel.users);
```

此外，可以在 *Presence Channel* 对象上绑定 `engine:user_added` 和 `engine:user_removed` 来处理用户上下线通知：

```js
presenceChannel.bind('engine:user_added', function (user) {
    console.log('新用户：', user.id, user.info);
});

presenceChannel.bind('engine:user_removed', function (user) {
    console.log('用户离开：', user.id, user.info);
});
```

## Chat

*Chat* 相关功能主要通过 `Engine` 实例上的 `chatManager` 完成。

### 用户相关

#### 登录

```js
engine.chatManager.login({
    // 这里使用 authData 将覆盖实例化 Engine 时的参数
    authData: 'abcdefghijklmn',
    // 登录成功处理函数，通常需要进行获取群组列表、会话列表等操作,
    // 注意，网络断开时会自动重连并重新 login ，该回调也会被再次执行
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    },    
    // 可见用户（好友或同群组）上下线通知处理函数
    onUserPresenceChanged: function (presence) {
        console.log(presence);
    },
    // 新消息处理函数
    onNewMessage: function (message) {
        console.log(message);
    }
});
```

`result` 结构：

```js
{
    // 该次 login 是否为新用户
    isNew: true
}
```


`presence` 结构：

```js
{
    userId: '1111',
    // 变为哪个状态，online 或 offline
    changedTo: 'online'
}
```

`message` 结构：

```js
{
    messageId: 300,
    // singleChat （单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 来自谁， userId
    from: '1111',
    // 发给谁， userId 或 groupId
    to: '1112',
    content: {
        type: 'text',
        text: 'Hello World!'
    },
    createdAt: '2015-01-25T07:47:09.678Z'
}
```

#### 登出

```js
engine.chatManager.logout({
    onSuccess: function () {
        console.log('Logout success');
    },
    onError: function (err) {
        console.log(err);
    }
});
```


#### 获取当前用户及登录状态

```js
// 内容为认证用户时你的服务端所返回的 userData
console.log(engine.chatManager.user);

// 枚举值： initialized, loggingIn, loggedIn, failed
console.log(engine.chatManager.state);
```

### 群组相关

#### 获取群组列表

```js
engine.chatManager.getGroups({
    // 可选，根据 id 过滤
    groupId: '54c4951f50c5e752c0a512a1',
    // 可选，根据 name 过滤
    name: 'group name',    
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});

```

`result` 结构：

```js
[{
    groupId: '54c4951f50c5e752c0a512a1',
    // 创建者 userId
    owner: '1111',
    name： 'group name',
    description: 'group description',
    // 任何用户的加群请求都会直接通过，无需审核
    isPublic: true,
    // 除创建者（owner）外，其他群用户也可以发送加群邀请
    userCanInvite: true,
    // 当前群用户数
    userCount: 100,
    // 群用户数上限
    userCountLimit: 1000
}]
```

#### 获取群组用户列表

```js
engine.chatManager.getGroupUsers({
    groupId: '54c4951f50c5e752c0a512a1',
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
[{
    userId: '1111',
    // 在线状态， online 或 offline
    presence: 'online'
}]
```

#### 创建群组

```js
engine.chatManager.createGroup({
    // 必选，群组名称
    name: 'group name',
    // 可选，群组描述
    descriptin: 'group description',
    // 默认值 true ，任何用户的加群请求都会直接通过，无需审核
    isPublic: true,
    // 默认值 true ，除创建者（owner）外，其他群用户也可以发送加群邀请
    userCanInvite: true,
    // 邀请这些用户加入群组
    inviteUserIds: ["1111"],
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
{
    groupId: '54c4951f50c5e752c0a512a1',
    // 成功的向这些用户发送了邀请
    invitedUserIds: ['1111']
}
```

#### 邀请用户加入群组

```js
engine.chatManager.inviteUsersIntoGroup({
    groupId: '54c4951f50c5e752c0a512a1',
    userIds: ['1111'],
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
{
    // 成功的向这些用户发送了邀请
    "invitedUserIds": ['1111']
}
```

#### 将用户移出群组

```js
engine.chatManager.removeGroupUsers({
    groupId: '54c4951f50c5e752c0a512a1',
    userIds: ['1111'],
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

#### 主动离开群组

```js
engine.chatManager.leaveGroup({
    groupId: '54c4951f50c5e752c0a512a1',
    onSuccess: function () {
        console.log('Leave group success');
    },
    onError: function (err) {
        console.log(err);
    }
});
```

### 会话相关

#### 获取会话列表 

```js
engine.chatManager.getConversations({
    // 可选， Conversation 类型， singleChat（单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 可选，跟谁， userId 或 groupId
    target: '1111',
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
[{
    // Conversation 类型， singleChat（单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 跟谁， userId 或 groupId
    target: '1111',
    // 未读消息数
    unreadMessageCount: 7,
    // 上次活动时间
    lastActiveAt: '2015-01-25T07:47:09.678Z'
}]
```

#### 重置会话未读消息数 

```js
engine.chatManager.resetConversationUnread({
    // Conversation 类型， singleChat（单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 跟谁， userId 或 groupId
    target: '1111'
});
```

#### 删除会话

```js
engine.chatManager.deleteConversation({
    // Conversation 类型， singleChat（单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 跟谁， userId 或 groupId
    target: '1111'，
    onSuccess: function () {
        console.log('Conversation deleted');
    },
    onError: function (err) {
        console.log(err);
    }
});
```

### 消息相关

#### 获取历史消息

```js
engine.chatManager.getMessages({
    // Conversation 类型， singleChat（单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 跟谁， userId 或 groupId
    target: '1111',
    // 可选
    startMessageId: 100,
    // 可选
    endMessageId: 300,
    // 可选，默认 20，最大 100
    limit: 20,
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
[{
    messageId: 300,
    // singleChat （单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 来自谁， userId
    from: '1111',
    // 发给谁， userId 或 groupId
    to: '1112',
    content: {
        type: 'text',
        text: 'Hello World!'
    },
    createdAt: '2015-01-25T07:47:09.678Z'
}]
```

#### 发送消息

```js
engine.chatManager.sendMessage({
    // singleChat （单聊） 或 groupChat （群聊）
    type: 'singleChat',
    // 发给谁， userId 或 groupId
    to: '1112',
    content: {
        type: 'text',
        text: 'Hello World!'
    },
    onSuccess: function (result) {
        console.log(result);
    },
    onError: function (err) {
        console.log(err);
    }
});
```

`result` 结构：

```js
{
    "messageId": 300
}
```

## 断开连接

在 `connection` 对象上调用 `disconnect` 即可：

```js
engine.connection.disconnect();
```

## 调试

在浏览器开发者工具 Console 中运行 `Engine.debug.enable('engine:*')` 可以启用调试日志，要停用运行 `Engine.debug.disable()` 即可。

## 升级步骤

# v0.9.2 至 1.0.0

- 替换 `engine.js` 即可。
- `chatManager`:
    - 移除了 `chatManager.loggedIn` ，新增 `chatManager.state`
