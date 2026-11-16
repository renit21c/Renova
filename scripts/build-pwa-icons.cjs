// Export the existing Renova artwork at installation sizes; keep a safe margin for OS masks.
const fs=require('node:fs'),sharp=require('sharp');
async function build(){
  fs.mkdirSync('public/icons',{recursive:true});
  for(const size of [192,512])await sharp('public/favicon.png').resize(size,size,{fit:'contain',background:'#fbf7fa'}).flatten({background:'#fbf7fa'}).png().toFile(`public/icons/icon-${size}.png`);
  await sharp('public/favicon.png').resize(360,360,{fit:'contain',background:'#fbf7fa'}).flatten({background:'#fbf7fa'}).extend({top:76,bottom:76,left:76,right:76,background:'#fbf7fa'}).png().toFile('public/icons/icon-maskable-512.png');
  await sharp('public/favicon.png').resize(180,180,{fit:'contain',background:'#fbf7fa'}).flatten({background:'#fbf7fa'}).png().toFile('public/icons/apple-touch-icon.png');
}
build().catch(error=>{console.error(error);process.exitCode=1;});
