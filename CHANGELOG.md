## Change Log

2.1.0:

* 新增： `Chat` 离线功能

2.0.0:

* 新增：`Chat` 多媒体消息，可发送图片、语音、视频、地理位置等，丰富聊天内容
* 新增：`Chat` 缓存，可对群组、会话和消息进行本地缓存，节省网络流量
* 新增：`Chat` 消息可携带附加信息，用以实现应用自定义业务逻辑
* 更新：`Pub/Sub` 及 `Chat` 原有 `API` 被按功能分发到各个子模块
* 更新：`Chat` 移除了 `Chat Group` 的 `name`, `description` 属性

1.0.0:

* 更新：`Chat` 获取当前用户及登录状态 `API`

0.9.2:

* 修复：`Presence Channel users.me` 为空

0.9.1:

* 新增：`Chat` 应用模式

0.9.0:

* 新增：`Connection` 实时连接
* 新增：`Pub/Sub` 应用模式
