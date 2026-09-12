/* 咒术转盘 · 单转盘数据文件
   转盘名：穿越后的颜值
   顺序：第 8 位（order 字段；顺序也可以在网页的「转盘」页拖动调整）
   改完保存、刷新网页即可生效（浏览器直接读这个文件）
   next 写「转盘名字」表示下一步去哪个转盘；写 "结束" 表示流程到此为止；不写就留在本盘
   branch: true 表示这是「分支转盘」：不在默认顺序里，只能被别的转盘的选项分支指到；
           它抽完若没给该选项设 next，会自动接着「拐进来的那个转盘」的默认下一站继续。
   weight 是权重（决定扇区大小与概率），留空默认 1；color 可写 "#B23A2F" 固定扇区颜色 */
window.__ZW_REGISTER({
  "order": 8,
  "name": "穿越后的颜值",
  "next": "道德水平",
  "removeAfterPick": false,
  "options": [
    { "label": "E（面目可憎）", "weight": 13 },
    { "label": "令人看多了简直会诞生咒灵", "weight": 5 },
    { "label": "EX（咒术魅魔）", "weight": 6 },
    { "label": "SSS（倾国倾城）", "weight": 7 },
    { "label": "SS（沉鱼落雁）", "weight": 10 },
    { "label": "S（国色天香）", "weight": 12 },
    { "label": "A（花容月貌）", "weight": 12 },
    { "label": "B（眉清目秀）", "weight": 13 },
    { "label": "C（其貌不扬）", "weight": 12 },
    { "label": "D（尖嘴猴腮）", "weight": 9 }
  ]
});
