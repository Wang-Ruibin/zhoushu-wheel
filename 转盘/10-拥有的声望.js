/* 咒术转盘 · 多面转盘数据文件
   转盘名：拥有的声望
   顺序：第 10 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）
   改完保存、刷新网页即可生效（浏览器直接读这个文件）
   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘
   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；
           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。
   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */
window.__ZW_REGISTER({
  "order": 10,
  "name": "拥有的声望",
  "next": "",
  "multi": true,
  "faceBy": "道德水平",
  "faces": [
    { "when": { "type": "gradeAtLeast", "value": "A" }, "options": [
    { "label": "EX（万众敬仰）", "weight": 6 },
    { "label": "SSS（名满咒术界）", "weight": 9 },
    { "label": "SS（德高望重）", "weight": 11 },
    { "label": "S（备受敬重）", "weight": 13 },
    { "label": "A（小有美名）", "weight": 14 }
    ] },
    { "when": { "type": "gradeAtMost", "value": "B" }, "options": [
    { "label": "EX（恶名震世）", "weight": 6 },
    { "label": "SSS（凶名赫赫）", "weight": 9 },
    { "label": "SS（人人畏惧）", "weight": 11 },
    { "label": "S（声名狼藉）", "weight": 13 },
    { "label": "A（小有恶名）", "weight": 14 }
    ] }
  ],
  // 道德还没抽到时使用下面的中性兜底面
  "removeAfterPick": false,
  "options": [
    { "label": "E-（无人知晓）", "weight": 8 },
    { "label": "E（寂寂无名）", "weight": 10 },
    { "label": "D（偶有耳闻）", "weight": 12 },
    { "label": "C（略有名气）", "weight": 14 },
    { "label": "B（广为人知）", "weight": 12 }
  ]
});
