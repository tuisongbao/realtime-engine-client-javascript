
<div class="alert alert-warning">
    阅读此文档前，请先阅读 [实时引擎指南](docs/engineGuide) 。
</div>

## 浏览器兼容

基本功能兼容 IE8+ 以及各种最新版的现代浏览器，包括 Chrome 、 FireFox 、 Safari 等。

*Chat* 模式语音、视频消息的录制发送仅支持 Chrome、 Firefox 。

## API 文档

本指南只给出简要集成说明，具体使用时请参考 [API 文档](docs/engineAPI/clientJavaScript)

## 安装

![bower](https://img.shields.io/bower/v/tuisongbao-realtime-engine-client.svg)

从 [这里](downloadSDK/engine##javascript) 下载，或者使用 bower 安装：

```bash
bower install tuisongbao-realtime-engine-client
```

然后引用安装目录下的 `engine.js` 或 `engine.min.js` 即可:

```html
<script src="/path/to/engine.min.js"></script>
```

## 预备知识

- 在浏览器开发者工具 Console 中运行 `Engine.debug.enable('engine:*')` 可以启用调试日志，要停用运行 `Engine.debug.disable()` 即可。

## 配置并建立连接

实例化 `Engine` 时可以通过第二个参数传递各种选项：

```js
var options = {
    // 认证用户的地址
    authEndpoint: 'http://yourdomain.com/tuisongbao_engine/auth',
    // 认证用户请求方式，默认为 `xhr` ，使用 XMLHttpRequest ，但是该方式在 IE8/9 上存在跨域问题，如果你配置的 authEndpoint 跨域并且需要支持 IE8/9 ，应使用 `jsonp` ，同时请确保你的服务端支持 `jsonp` 请求，该设置在所有浏览器上生效，并非仅在 IE8/9 上生效
    authTransport: 'jsonp',
    // 可选，如果配置，认证请求将携带该值，可以用来表明用户身份。当结合 jsonp 使用时，该值如果为 Object ，会被序列化成 JSON 字符串。
    authData: 'authData-sample'
    // 使用扩展功能（Chat 本地缓存，多媒体消息）时必须指定 engine.js 在 Web 服务器上的父级路径
    basePath: '/engine/clientJavaScript/',
    // 可选， 作用是在网络不可用时， SDK 支持某些 API 的调用。详情请参照 Chat 章的缓存策略
    supportOffline: true,
    // Chat 相关选项，不使用 Chat 模式则无需配置
    chat:
        // 开启本地缓存, 此功能支持 Chrome, Firefox, IE11
        enableCache: true,
        // 启用多媒体消息(图片，语音，视频)发送功能，开启此选项将会异步加载额外的资源文件
        enableMediaMessage: true
};

var engine = new Engine('YOUR_APP_ID', options);
```

实例化后，连接将自动建立，你可以使用返回的 `Engine` 实例进行后续各种操作。

### Connection Event

在 `engine.connection` 对象上，可以监听如下 *Event* ：

- `state_changed` ：连接状态变化时触发。
- `connecting_in` ：通知下次重连是在多久以后。
- 以及 `initialized`， `connected`， `disconnected`, `connecting`, `failed`，分别于 `Connection` 进入该状态时触发。
- `error` ：连接发生错误时触发。

```js
connection.bind('state_changed', function (states) {
    console.log(states.previous, states.current);
});

connection.bind('connecting_in', function (delay) {
    console.log('重连将在 ' + delay + 'ms 后进行');
});

connection.bind('connecting', function () {
    // 提醒用户网络不稳定，正在尝试建立连接
});

connection.bind('error', function (err) {
    console.log(err);
});
```

### 获取 SocketId

```js
connection.bind('connected', function () {
    console.log(connection.socketId);
});
```

### 断开连接

在 `connection` 对象上调用 `disconnect` 即可：

```js
connection.disconnect();
```

若要恢复连接，调用 `connect` ：

```js
connection.connect();
```

## Pub/Sub

*Pub/Sub* 相关功能主要通过 `engine.channels` 完成。

### 获得 channel 管理对象 channels

```js
var channels = engine.channels;
```

### 订阅 Channel

```js
var coolChannel = channels.subscribe('cool-channel');
```

该方法返回 `Channel` 实例，可用于 `bind` 等操作。

另外也可以通过 `channels` 的 `find` 方法获取已订阅的 `Channel` 实例:

```js
var coolChannel = channels.find('cool-channel');
```

使用 `unsubscribe` 方法来取消订阅：

```js
channels.unsubscribe('cool-channel');
```

### 绑定 Event 处理函数

```js
coolChannel.bind('cool-event', function (data) {
    // 处理逻辑
});
```

该操作只应用于当前 `Channel`，也就是说你可以在其他 `Channel` 上使用相同的 *Event* 名字。

使用 `unbind` 方法来解除绑定：

```js
// 只解绑这个 Event 的某个处理函数
coolChannel.unbind('cool-channel', handler);
// 解绑这个 Event 的所有处理函数
coolChannel.unbind('cool-channel');
```

### Channel Event

所有 `Channel` 都可以通过监听 `engine:subscription_succeeded` 和 `engine:subscription_error` *Event* 来处理订阅结果：

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
        id: '1111',
        info: 'Fake user info for socket 111111 on channel presence-demo'
    }
}
```

示例如下：

```js
presenceChannel.bind('engine:subscription_succeeded', function (users) {
    console.log('订阅 channel ' + presenceChannel.name + ' 成功');
    console.log('用户量：' + users.count);

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

此外，可以在 *Presence Channel* 对象上监听 `engine:user_added` 和 `engine:user_removed` 来处理用户上下线通知：

```js
presenceChannel.bind('engine:user_added', function (user) {
    console.log('新用户：', user.id, user.info);
});

presenceChannel.bind('engine:user_removed', function (user) {
    console.log('用户离开：', user.id, user.info);
});
```

## Chat

*Chat* 相关功能主要通过 `engine.chatManager` 完成。

#### ChatManager Event

```js
chatManager.bind('login:succeeded', function() {
    console.log('登录成功');
});

chatManager.bind('login:failed', function(err) {
    console.log('登录失败');
});

chatManager.bind('message:new', function(message) {
    console.log('新消息');
});
```

更多 *Event* 请参考 [API 文档](docs/engineAPI/clientJavaScript/) 。

### 用户相关

#### 登录

```js
chatManager.login({
    authData: chatUserId
});

var onLoginSucceeded = function() {
    console.log('login succeeded');
};
var onLoginError = function(err) {
    console.log('login failed：', err);
};

engine.chatManager.bind('login:succeeded：', onLoginSucceeded);
engine.chatManager.bind('login:failed：', onLoginError);
```

#### 登出

```js
chatManager.logout().then(function() {
    console.log('登出成功');
}).catch(function(err){
    console.log('登出失败' + err);
});
```

#### 获取当前用户及登录状态

```js
// 内容为认证用户时你的服务端所返回的 userData
console.log(engine.chatManager.user);

// 枚举值： initialized, loggingIn, loggedIn, failed, loggedOut
console.log(engine.chatManager.state);
```

### 会话相关

#### 获取会话列表

通过 `chatManager.conversations` 来获取会话列表。

Promise 写法：

```js
conversations.load().then(function(conversations) {
    console.log('成功获取 Conversation 实例的列表');
}).catch(function(err) {
    console.log('获取失败，请稍后再试');
});
```

回调写法：

```js
conversations.load({
    onSuccess: function(conversations) {
        console.log('成功获取 Conversation 实例的列表');
    },
    onError: function(err) {
        console.log('获取失败，请稍后再试');
    }
});
```

关于 Promise 和 回调的说明，请查看[此处](docs/engineGuide/clientJavaScript##%23%23%E8%A1%A5%E5%85%85%E8%AF%B4%E6%98%8E)。

#### 获取 ChatConversation 的实例

开发者可以调用 `ChatConversation` 实例上的方法实现发送消息，删除会话，重置未读消息等功能，它可以像上面的例子一样从会话列表中获得，也可以通过 `conversations.loadOne` 获取特定的会话：

```js
conversations.loadOne({
    type: 'singleChat',
    target: '1111'
}).then(function(_conversation) {
    conversation = _conversation
});
```

#### 获取会话历史消息

```js
conversation.loadMessages({
    // Conversation 类型， singleChat（单聊）或 groupChat（群聊）
    type: 'singleChat',
    // 跟谁(聊天另一方的 ID)， userId 或 groupId
    target: '1111',
    // 可选
    startMessageId: 100,
    // 可选
    endMessageId: 300,
    // 可选，默认 20，最大 100
    limit: 20
    // 其他参数请参照 API 文档
}).then(function(messages) {
    console.log('成功获取会话消息');
    // 在开启支持离线功能时，离线存储的 message 包含三个状态 `sending`， `succeeded`， `failed` 。当状态为 `sending` 时会在调用 loadMessages 之前重发消息，过程中可能导致 message 状态改变，如果需要跟踪 message 的状态，你可以监听 `state:changed` 事件
    messages.map(function (message){
        if(message.state !== 'succeeded'){
            message.bind('state:changed', function (state){
                // Message 状态改变， 刷新 UI 的逻辑可以写在这里
                console.log("变化前的状态：", state.previous);
                console.log("当前状态", state.current);
            });
        }
    });
}).catch(function(err) {
    console.log('获取失败，请稍后再试');
});
```

#### 将会话未读消息数重置为 0

```js
conversation.resetUnread();
```

#### 删除会话

```js
conversation.delete().then(function() {
    console.log('成功删除会话');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

### 消息相关

#### 监听新消息

通过在 `ChatConversation` 对象上监听 `message:new` *Event* 来监听新消息：

```js
conversation.bind('message:new', function(newMessage) {
    console.log('你收到一条来自的' + newMessage.from + '的新消息');

    // type 枚举: 'text', 'image', 'voice', 'video', 'location', 'event'
    console.log('消息的类型为：' + newMessage.content.type);

    if (newMessage.content.file) {
        console.log('多媒体文件下载地址：' + newMessage.content.file.url);
        console.log('多媒体文件大小：' + newMessage.content.file.size);
    } else if (newMessage.content.location) {
        console.log('地理位置为（兴趣点）：' + newMessage.content.location.poi);
    } else if (newMessage.content.event) {
        console.log(' Event 类型为：' + newMessage.content.event.type);
    } else {
        console.log('你发的是文本消息, 内容为：' + newMessage.content.text);
    }
    console.log('附加信息：' + newMessage.content.extra);
    console.log('发送时间：' + newMessage.createdAt);
});
```

#### 发送文本消息

```js
conversation.sendMessage({
    type: 'text',
    text: 'Hello World!',
    // 可选，附加信息，用于实现应用自定义业务逻辑
    extra: {}
}).then(function(message) {
    console.log(message);
}).catch(function(err) {
    console.log('发送失败，请稍后再试');
});
```

#### 发送图片消息

#### 获取 ImageUploader

```js
conversation.getImageUploader({
    // 触发文件选择的 DOM 元素的 ID
    browseButton: 'imageMessage',
    // 可选，拖曳区域的 DOM 元素的 ID，可实现拖曳上传
    dropElementId: 'messageContainer',
    // 可选，附加信息，用于实现应用自定义业务逻辑
    extra: {}
}).then(function(imageUploader) {
    console.log('成功获取了 imageUploader，可以在上面监听 Event 了');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

初始化后，用户点击 `browseButton` 会弹出文件选择对话框，当用户选择文件后， 文件会自动上传并发送消息。

#### 可以在 ImageUploader 上绑定相关的 Event 处理函数

```js
imageUploader.bind('failed', function(err) {
    console.log('imageUploader 初始化失败：' + err);
});
imageUploader.bind('message:sent', function(sentMessage) {
    console.log('发送图片消息成功：' + sentMessage);
});
imageUploader.bind('message:sendFailed', function(err) {
    console.log('发送图片消息失败：' + err);
});
imageUploader.bind('state:changed', function(state) {
    // state 的可能取值为： initialized（初始化完成），uploaded（上传成功），uploading（正在上传），failed（初始化失败）
    console.log('上传图片消息的状态：' + state);
});
```

#### 销毁对象

```js
// 解绑这个 Event 的所有处理函数, 并销毁 imageUploader 这个对象和相应文件选择的 DOM 节点
imageUploader.destroy()
```

#### 发送语音消息

发送语音消息是通过 `VoiceUploader` 来完成的

`VoiceUploader` 提供了一系列发送语音消息的方法，详见 [API](docs/engineAPI/clientJavaScript/index.html#ChatVoiceUploader)

- `startRecord`: 开始录制语音
- `stopRecord`: 停止录制语音
- `send`: 发送录制的语音

#### 获取 VoiceUploader

```js
conversation.getVoiceUploader({
    // 可选，附加信息，用于实现应用自定义业务逻辑
    extra: {}
}).then(function(voiceUploader) {
    console.log('成功获取了 voiceUploader，可以在上面监听 Event 了');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

#### 通过 VoiceUploader 可以绑定相关 Event 处理函数

```js
voiceUploader.bind('failed', function(err) {
    console.log('VoiceUploader 初始化失败：' + err);
});
voiceUploader.bind('message:sent', function(sentMessage) {
    console.log('发送语音消息成功：' + sentMessage);
});
voiceUploader.bind('message:sendFailed', function(err) {
    console.log('发送语音消息失败：' + err);
});
voiceUploader.bind('state:changed', function(state) {
    // state 的可能取值为： initialized（初始化完成），recording（正在录制），recorded（录制成功），uploaded（上传成功），uploading（正在上传），failed（初始化失败）
    console.log('录制、上传语音消息的状态：' + state);
});
voiceUploader.bind('record:started', function() {
    console.log('录制开始');
});
voiceUploader.bind('record:stopped', function(blob, duration) {
    console.log('录制结束，返回 blob 对象和时长');
});
```

#### 销毁对象

```js
// 解绑这个 Event 的所有处理函数, 并销毁 voiceUploader 对象
voiceUploader.destroy()
```

#### 发送视频消息

发送视频消息是通过 `VideoUploader` 来完成的

`VideoUploader` 提供了一系列发送视频消息的方法，详见 [API](docs/engineAPI/clientJavaScript/index.html#ChatVideoUploader)

- `startRecord`: 开始录制视频
- `stopRecord`: 停止录制视频
- `send`: 发送录制的视频

#### 获取 VideoUploader

```js
conversation.getVideoUploader().then(function(videoUploader) {
    console.log('成功获取 videoUploader，可以在上面监听 Event 了');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

#### 通过 VideoUploader 可以绑定相关 Event 处理函数

```js
videoUploader.bind('failed', function(err) {
    console.log('VideoUploader 初始化失败：' + err);
});
videoUploader.bind('message:sent', function(sentMessage) {
    console.log('发送视频消息成功：' + sentMessage);
});
videoUploader.bind('message:sendFailed', function(err) {
    console.log('发送视频消息失败：' + err);
});
videoUploader.bind('state:changed', function(state) {
    // state 的可能取值为： initialized（初始化完成），recording（正在录制），recorded（录制成功），uploaded（上传成功），uploading（正在上传），failed（初始化失败）
    console.log('录制、上传视频消息的状态：' + state);
});
voiceUploader.bind('record:started', function() {
    console.log('录制开始');
});
videoUploader.bind('record:stopped', function(blob, duration) {
    console.log('录制结束，返回 blob 对象和时长');
})
```

```js
// 解绑所有的 Event，并销毁 videoUploader 这个对象和相应录制视频的 DOM 节点
videoUploader.destroy()
```

#### 发送地理位置消息

```js
chatManager.locationHelper.getLocation().then(function(location) {
    // 返回当前的位置的经纬度
    console.log('当前的位置是：' + location);
    // 发送地理位置消息
    conversation.sendMessage({
        type: 'location',
        location: {
            // 纬度
            lat: location.lat
            // 经度
            lng: location.lng
            // 可选，兴趣点，如果不填，推送宝将尝试从百度地图获取
            poi: location.poi
        }，
        // 可选，附加信息，用于实现应用自定义业务逻辑
        extra: {}
    }).then(function(message) {
        console.log(message);
    }).catch(function() {
        console.log('发送失败，请稍后再试');
    });
}).catch(function(err) {
    console.log('err: ' + err);
});
```

### 群组相关

#### 获取群组列表

通过 `chatManager.groups` 可以获取群组列表：

```js
// 无参数，该接口用来同步最新的群组列表
chatManager.groups.load({
    // 可选，根据 id 过滤
    groupId: '54c4951f50c5e752c0a512a1'
}).then(function(groups) {
    console.log(groups);
}).catch(function(err) {
    console.log('获取失败，请稍后再试');
});
```

#### 创建群组

```js
chatManager.groups.create({
    // 群组是否公开（true：任何用户的加群请求都会直接通过，无需审核； false：需要管理者审核）
    isPublic: true,
    // 除创建者（owner）外，其他群用户是否可以可以发送加群邀请（true：可以； false：不可以）
    userCanInvite: true
    // 初始成员， 创建成功后会向这些用户发送群组邀请，若被邀请者的 acceptAllJoinGroupInvitation 为 true 时直接加入该组
    inviteUserIds: ['1111', '2222']
}).then(function(_group) {
    group = _group;
}).catch(function(err) {
    console.log('创建失败，请稍后再试');
});
```

#### 获取群组用户列表

```js
group.loadUsers().then(function(users) {
    console.log('成功获取群组用户');
}).catch(function(err) {
    console.log('获取失败，请稍后再试');
});
```

`users` 结构：

```js
[{
    userId: '1111',
    // 在线状态，online 或 offline
    presence: 'online'
}]
```

#### 邀请用户加入群组

```js
group.inviteUsers({
    userIds: ['1111']
}).then(function() {
    console.log('成功获取群组用户');
}).catch(function(err) {
    console.log('获取失败，请稍后再试');
});
```

#### 将用户移出群组

```js
group.removeUsers({
    userIds: ['1111']
}).then(function(users) {
    console.log('成功移出用户');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

#### 主动离开群组

```js
group.leave().then(function() {
    console.log('成功离开群组');
}).catch(function(err) {
    console.log('操作失败，请稍后再试');
});
```

### 补充说明

#### 关于 Promise

`ChatManager` 中除了 `login` 外所有的方法都支持 `promise` 和回调两种异步书写方式，具体请查阅 [API 文档](docs/engineAPI/clientJavaScript/) 。

#### 关于 Event

`ChatManager`, `ChatConversation`, `ChatUploader` 等均继承于 [EventEmitter](docs/engineAPI/clientJavaScript/index.html#EventEmitter)，因此在这些对象上均可使用 `bind` 方法绑定事件处理函数和 `unbind` 方法解绑事件处理函数。

#### 关于消息的附加信息 extra

所有消息类型均支持 extra，用以实现应用自定义的业务逻辑。

#### 关于权限

发送语言、视频、地理位置消息时需要向浏览器请求相应的权限， SDK 会适时的向浏览器发送该请求，只有用户同意之后才能正常发送消息。

### 注意事项

- 除了登录之外，所有 API 都 **必须** 在用户成功登录之后再调用，否则会返回错误。

## 升级步骤

### v1.0.0 至 2.0.0

- 替换 `engine.js`
- pub/sub 相关的方法被移至 `engine.channels` 上
- `ChatManager` 上除 `login`， `logout` 外所有 API 都按功能分发到各个子模块，参见 [API 文档](docs/engineAPI/clientJavaScript/)

### v0.9.2 至 1.0.0

- 替换 `engine.js` 即可
- `chatManager`:
    - 移除了 `chatManager.loggedIn` ，新增 `chatManager.state`
