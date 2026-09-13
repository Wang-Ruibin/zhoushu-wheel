/* 咒术转盘 · 单转盘数据文件
   转盘名：体质（基础体质）
   顺序：第 16 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）
   改完保存、刷新网页即可生效（浏览器直接读这个文件）
   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘
   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；
           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。
   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */
window.__ZW_REGISTER({
  "order": 16,
  "name": "体质（基础体质）",
  "next": "咒力效率",
  "removeAfterPick": false,
  "options": [
    { "label": "E-（宿便级）", "weight": 5 },
    { "label": "E（残疾）", "weight": 6 },
    { "label": "D（体弱多病）", "weight": 8 },
    { "label": "C（普通人）", "weight": 10 },
    { "label": "B（体育生）", "weight": 11 },
    { "label": "A（顶尖运动员）", "weight": 12 },
    { "label": "S（普通人极限）", "weight": 12 },
    { "label": "SS（入学虎）", "weight": 10 },
    { "label": "SSS（天与暴君）", "weight": 9 },
    { "label": "EX（五宿咒力强化水平）", "weight": 5 }
  ]
});
