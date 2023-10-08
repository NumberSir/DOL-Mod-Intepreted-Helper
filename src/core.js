const fs = require('fs');
const path = require('path');

const axios = require('axios');
const {ResetMode, simpleGit} = require("simple-git");

const {
    ROOT, DATA_DIR, MODS_DIR, RESULTS_DIR,
    BOOT_KEYS,
} = require('./consts.js');
const {walkDir} = require('./utils');

class GameSourceCode {
    async initDirs() {
        await promisify(fs.mkdir)(DATA_DIR);
    }

    async getLatestCommit() {
        const url = "https://gitgud.io/api/v4/projects/8430/repository/commits";
        const filepath = path.join(DATA_DIR, './commits.json');

        // async-await 模式 写法
        try {

            // 文件不存在则非最新
            let currentData = null;
            await promisify(fs.access)(filepath).catch(E => {
                console.log("commits.json non-existence");
                return Promise.reject(E);
            });
            const data = await promisify(fs.readFile)(filepath).catch(err => {
                console.log("ERROR while reading commits.json: ", err);
                return Promise.reject(err);
            });
            currentData = JSON.parse(data.toString());

            // 获取最新版本
            const response = await axios.get(url);

            let newData = response.data;
            // 是最新
            if (currentData && currentData["short_id"] === newData[0]["short_id"]) {
                console.log("CURRENT LOCAL SOURCE CODE IS LATEST")
                return
            }
            // 非最新
            console.log("CURRENT LOCAL SOURCE CODE IS LATEST")
            await promisify(fs.writeFile)(filepath, JSON.stringify(newData[0])).catch(err => {
                console.log("ERROR while writing commits.json: ", err);
                return Promise.reject(err);
            });

        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    async updateSourceRepository() {
        const url = "https://gitgud.io/Vrelnir/degrees-of-lewdity.git";
        const baseDir = path.join(ROOT, "../degrees-of-lewdity");
        const git = simpleGit(baseDir, ({method, stage, progress}) => {
            console.log(`git.${method} ${stage} stage ${progress}% complete`)
        });

        await fs.access(baseDir, async (err) => {
            if (err) {
                // 不存在，直接克隆下来
                console.log("Starting cloning repo...");
                await git.clone(url, baseDir).then((hash) => {
                    console.log("Repo cloned: ", hash);
                });
            } else {
                console.log("Starting fetching repo...");
                await git.fetch('origin', 'master', {},(err) => {
                    if (err) {
                        console.log("ERROR while pulling repo: ", err);
                    }
                }).then(() => {
                    git.reset(ResetMode.HARD);
                    console.log("Repo fetched");
                });
            }
        })

    }
}


class GameMod {
    constructor() {
        this.bootJsonDatas = {};
    }
    async initDirs() {
        await fs.mkdir(MODS_DIR, () => {});
        await fs.mkdir(RESULTS_DIR, () => {});
    }
    /** 编写 boot.json */
    async initBootJson() {
        // 确定都有哪些模组
        let modsNameList = [];
        await fs.readdir(MODS_DIR, async (err, files) => {
            for (const file of files) {
                await fs.stat(path.join(MODS_DIR, `./${file}`), async (err, stats) => {
                    if (stats.isDirectory()) {
                        modsNameList.push(file);
                        console.log(`name1: ${file}`)
                        await fs.mkdir(path.join(RESULTS_DIR, `./${file}`), () => {});
                    }
                });
            }
        });

        // 初始化每个模组的 boot.json
        for (const name of modsNameList) {
            for (let key in BOOT_KEYS.required) {
                this.bootJsonDatas[name][key] = BOOT_KEYS.required[key]
            }
            let bootJsonFlag = false;

            await fs.readdir(path.join(MODS_DIR, `./${name}`), async (err, files) => {
                for (const file of files) {
                    if (file === "boot.json") {
                        // 填充作者写过的 boot.json 内容

                        bootJsonFlag = true;
                        await fs.readFile(path.join(MODS_DIR, `./${name}/boot.json`), (err, data) => {
                            let bootJsonDataTemp = JSON.parse(data.toString());

                            // 作者填过的就直接复制过来
                            for (let key of BOOT_KEYS.required) {
                                if (key in bootJsonDataTemp && bootJsonDataTemp[key] !== BOOT_KEYS.required[key]) {
                                    this.bootJsonDatas[name][key] = bootJsonDataTemp[key];
                                }
                            }

                            // 作者有写的就直接复制过来
                            for (let key of BOOT_KEYS.optional) {
                                if (key in bootJsonDataTemp) {
                                    this.bootJsonDatas[name][key] = bootJsonDataTemp[key];
                                }
                            }
                        });
                    }
                }

                if (!bootJsonFlag) {
                    console.warn(`MISSING boot.json IN ${name}!`);
                }
            });
        }

        await this.buildFileLists(modsNameList);
    }

    /** 所有文件对号入座 */
    async buildFileLists(modsNameList) {
        console.log(`list: ${modsNameList}`)
        for (const name of modsNameList) {
            console.log(`name2: ${name}`);
            await walkDir(path.join(MODS_DIR, `./${name}`), name);
        }
    }

    /** 所有替换内容对号入座 */
    buildReplacePatches() {}

    /** 打包 zip */
    buildZipPackage() {}

    /** 下载含 Modloader 版本游戏本体 */
    downloadModloader() {}

    /** 下载 I18N mod */
    downloadI18N() {}
}

(async () => {
    let game = new GameSourceCode();
    await game.initDirs();
    await game.getLatestCommit();
    await game.updateSourceRepository();

    let mod = new GameMod();
    await mod.initDirs();
    await mod.initBootJson();

}) ();
