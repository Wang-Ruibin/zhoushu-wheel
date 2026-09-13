/* 咒术转盘 · 单转盘数据文件
   转盘名：道德水平
   顺序：第 9 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）
   改完保存、刷新网页即可生效（浏览器直接读这个文件）
   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘
   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；
           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。
   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */
window.__ZW_REGISTER({
  "order": 9,
  "name": "道德水平",
  "next": "是否拥有生的术式",
  "removeAfterPick": false,
  "options": [
    { "label": "SS（光明磊落）", "weight": 12 },
    { "label": "SSS（高风亮节）", "weight": 10 },
    { "label": "EX（超凡入圣）", "weight": 6 },
    { "label": "E-（禽兽不如）", "weight": 8 },
    { "label": "E（丧心病狂）", "weight": 8 },
    { "label": "D（恬不知耻）", "weight": 9 },
    { "label": "C（见利忘义）", "weight": 11 },
    { "label": "B（见义勇为）", "weight": 14 },
    { "label": "A（安分守己）", "weight": 12 },
    { "label": "S（乐善好施）", "weight": 12 }
  ]
});
