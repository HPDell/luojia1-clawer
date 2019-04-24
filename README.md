# 珞珈一号影像数据爬虫

本仓库是用于按行政区下载 [珞珈一号](http://59.175.109.173:8888/index.html) 影像数据的爬虫。
支持断点续爬。没有文件校验，因此有时下载的影像会不可使用。

## 使用方法

爬虫的运行基于两个配置文件：

1. 爬虫参数配置文件 config.json 
2. 影像查询参数配置文件 params.json

### 爬虫参数

爬虫参数如下所示：

```jsonc
{
    "latestImagingTime": "2018-03-11 14:56:53",     // 上次下载的最后一幅影像的时间
    "username": "您的用户名",   // 用户名
    "password": "您的密码"      // 密码
}
```

`lastestImagingTime` 参数，在首次爬取的时候可以设置为 2018 年之前的日期，就可以获取到所有影像。

将 config-sample.json 重命名为 config.json 文件，并填入对应字段的正确值。

### 影像查询参数

修改 params.json 文件中配置的参数，符合如下模型：

```ts
interface QueryParams {
    productLevel: "L2" | "L3" | null;
    level: "province" | "city" | "district";
    zoneNo: number;
}
```

以广州市为例：

```jsonc
{
    "productLevel": "L2",   // 产品纠正级别，可选 L2 和 L3 ，填 null 表示全部。
    "level": "city",        // 行政区等级，可选 province, city, district，应与 zoneNo 对应。
    "zoneNo": 440100        // 行政区编号，需要从珞珈一号官网上抓包以获取到这个编号。
}
```

### 运行爬虫

修改完成后，使用如下命令运行爬虫：

```bash
node index.js
```

下载下来的影像会保存在 data 文件夹中。

## 其他事项

1. 程序中每次网络请求过后会通过 `delay()` 函数等待，如果觉得等待时长过长过过短，请自行调整，单位为毫秒。
2. 本次获取的所有影像的列表在 `data/image_list_*.csv` 文件中，如有文件下载错误，可手动下载。