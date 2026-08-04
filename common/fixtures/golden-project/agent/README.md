# PR-00000 agent 目录（golden fixture）

机器产物目录。夹具只保留 `project-manifest.json`；gate 运行产生的 `gate-results.json`、
`gate-history.json`、`evidence/**` 属于运行时产物，不入夹具，`golden-run.mjs` 结束即随
临时项目目录一起删除。
