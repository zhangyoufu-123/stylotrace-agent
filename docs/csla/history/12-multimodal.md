# 多模态（12）

## 认知状态输入

```text
O_t = {Text, Image, Audio, Video, Files, Environment}
Z_t = Encoder(O_t, S_t)
```

## 输出模态选择

```text
m* = argmin_m Loss(Idea, Representation_m)
```

原则：不是"支持图片/声音"，而是让系统判断什么模态最能承载当前思想。

## MVP 范围

第一代以 text + image + file 为主；audio/video 作为接口扩展，不阻塞认知闭环。
