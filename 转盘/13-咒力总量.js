/* 咒术转盘 · 单转盘数据文件
   转盘名：咒力总量
   顺序：第 13 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）
   改完保存、刷新网页即可生效（浏览器直接读这个文件）
   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘
   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；
           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。
   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */
window.__ZW_REGISTER({
  "order": 13,
  "name": "咒力总量",
  "next": "咒力操纵",
  "removeAfterPick": false,
  "options": [
    { "label": "D（三级）", "weight": 10 },
    { "label": "SS（乙骨）", "weight": 8 },
    { "label": "A（特级）", "weight": 12 },
    { "label": "E-（普通人）", "weight": 8 },
    { "label": "SSS（宿傩）", "weight": 9 },
    { "label": "E（四级—）", "weight": 8 },
    { "label": "C（二级）", "weight": 12 },
    { "label": "B（一级）", "weight": 12 },
    { "label": "S（五条）", "weight": 13 },
    { "label": "EX（伪无限）", "weight": 8 }
  ]
});
