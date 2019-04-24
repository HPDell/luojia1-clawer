import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import LoginResponseInfo from './models/LoginResponseInfo';
import { DatasQueryResponseInfo, NightLightImage } from './models/DatasQueryResponseInfo';
import { createWriteStream, writeFile, read, readJsonSync } from "fs-extra";
import { join, resolve } from "path";
import { stringify } from "querystring";
import { Stream } from 'stream';
import { Parser as Json2CsvParser } from "json2csv";
import * as moment from "moment";
import * as ConfigStore from "configstore";
import * as readline from "readline";
import format from "format-number";

axios.defaults.baseURL = "http://59.175.109.173:8888";
axios.defaults.transformRequest = function (data: any) {
    return stringify(data);
}

const HOME_PATH = process.cwd();
const progressFormat = format({
    padLeft: 3,
    suffix: '%',
    truncate: 0,
    padLeftChar: " "
});

const conf = new ConfigStore("config", {
    latestImagingTime: "",
    username: "",
    password: ""
}, {
    //@ts-ignore
    configPath: `${HOME_PATH}/config.json`
})

async function delay(timeout: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, timeout + Math.random() * 10);
    })
}

async function download (rootDir: string) {
    let loginStatus = await login(conf.get("username"), conf.get("password"));
    let pageSize = 20;
    let defaultQueryParams: QueryParams = readJsonSync(`${HOME_PATH}/params.json`);
    const latestImagingTime = moment(conf.get("latestImagingTime"), "YYYY-MM-DD HH:mm:ss");
    let imageList: NightLightImage[] = [];
    if (loginStatus) {
        console.log("已成功登陆系统");
        let firstPage = await fetchPage(1, pageSize, defaultQueryParams);
        if (firstPage) {
            console.log("已获取第1页");
            imageList = imageList.concat(firstPage.dataList);
            let pageNum = Math.ceil(firstPage.total / pageSize);
            for (let i = 2; i <= pageNum; i++) {
                await delay(2000);
                let page = await fetchPage(i, pageSize, defaultQueryParams);
                if (page) {
                    console.log(`已获取第${i}页`);
                    let downloadList = page.dataList.filter(image => {
                        let imagingTime = moment(image.imagingTime, "YYYY-MM-DD HH:mm:ss");
                        return imagingTime.isAfter(latestImagingTime);
                    })
                    imageList = imageList.concat(downloadList);
                } else {
                    console.log(`查询 第${i}页 失败。`)
                }
            }
            
        } else {
            console.log(`查询 第1页 失败。`)
        }
        saveList(imageList, `data/image_list_${moment().format("YYYY-MM-DD")}.csv`);
    } else {
        console.log("无法登陆系统");
    }
    let newLatestImagingTime = latestImagingTime;
    imageList = imageList.sort((a, b) => moment(a.imagingTime, "YYYY-MM-DD HH:mm:ss").diff(moment(b.imagingTime, "YYYY-MM-DD HH:mm:ss")))
    for (const image of imageList) {
        let imagingTime = moment(image.imagingTime, "YYYY-MM-DD HH:mm:ss");
        if (imagingTime.isAfter(newLatestImagingTime)) {
            newLatestImagingTime = imagingTime;
        }
        try {
            await downloadImage(image, resolve(rootDir, `${image.rspath}.tar.gz`));
            conf.set("latestImagingTime", newLatestImagingTime.format("YYYY-MM-DD HH:mm:ss"));
        } catch (error) {
            console.log(`下载 ${image.name} ${image.imagingTime} - ${image.id} 失败`);
        }
        await delay(2000);
    }
}

function saveList(imageList: ReadonlyArray<NightLightImage>, path: string) {
    let parser = new Json2CsvParser();
    let csv = parser.parse(imageList);
    writeFile(path, csv, (err) => {
        if (err) {
            console.log("保存列表失败： " + err);
        } else {
            console.log("保存列表成功");
        }
    })
}

async function login(username: string, password: string): Promise<boolean> {
    try {
        let response: AxiosResponse<LoginResponseInfo> = await axios.post("/users/login", {
            code: username,
            pwd: password
        });
        if (response.data && response.data.status == 1) {
            return true;
        } else {
            throw new Error("登陆失败");
        }
    } catch (error) {
        console.log(error);
        return false;
    }
}

interface QueryParams {
    productLevel: "L2" | "L3" | null;
    level: "province" | "city" | "district";
    zoneNo: number;
}

async function fetchPage(page: number, pageSize: number, params: QueryParams) {
    try {
        let response: AxiosResponse<DatasQueryResponseInfo> = await axios.post("/luojiadatas/property", {
            ...params,
            page,
            pageSize,
            sort: "imagingTime",
            order: "Z"
        });
        if (response.data) {
            return {
                total: response.data.total,
                dataList: response.data.data
            }
        } else {
            throw new Error("服务器没有返回值");
        }
    } catch (error) {
        console.group("查询影像列表失败", error);
        return null;
    }
}

async function downloadImage(image: NightLightImage, path: string) {
    let response = await axios({
        method: "GET",
        url: `/luojiadatas/${image.id}/resource/1`,
        responseType: "stream"
    });
    return new Promise((resolve, reject) => {
        const rs: Stream = response.data;
        const ws = createWriteStream(path.replace(/\s/g, "_"));
        const totalLenght = parseInt(response.headers["content-length"]);
        let curLength = 0;
        const stdout = process.stdout;

        stdout.write(`正在下载 ${image.name} ${image.imagingTime} 影像...   0%`)

        ws.on("close", function () {
            stdout.write("\n");
            resolve();
        });

        rs.on("error", function () {
            stdout.write(`出错\n`);
            reject();
        });

        

        rs.on("data", function (chunk: Buffer) {
            readline.moveCursor(stdout, -4, 0);
            curLength += chunk.byteLength;
            let percent = curLength / totalLenght * 100;
            let number = progressFormat(percent);
            stdout.write(number);
        })

        rs.pipe(ws);
    })
}

download("data");