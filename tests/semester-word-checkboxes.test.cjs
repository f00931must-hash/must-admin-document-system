const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'semester-isp-checkbox-export-fix.js'),'utf8');
const config=vm.runInNewContext(source.slice(source.indexOf('const supportConfig='),source.indexOf('function serialize'))+';supportConfig');
const dom=new JSDOM('');
const patch=vm.runInNewContext(source.slice(source.indexOf('function patchStaticCheckboxes'),source.indexOf('function patchOfficialRatings'))+';patchStaticCheckboxes',{supportConfig:config,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer});
const original=execFileSync('python',['-c',"import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))",path.join(root,'templates/semester-isp-template-v2.docx')],{maxBuffer:10*1024*1024}).toString();
const NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const parse=s=>new dom.window.DOMParser().parseFromString(s,'application/xml');
const text=p=>[...p.getElementsByTagNameNS(NS,'t')].map(t=>t.textContent).join('');
const compact=s=>s.replace(/[\s　]/g,'').replace(/／/g,'/').replace(/[－–—]/g,'-');
function apply(xml,selected){let value=xml;patch({file(name,data){if(data!==undefined)value=data;return {asText:()=>value}}},selected);return value}
for(const [group,options] of Object.entries(config))for(const option of options){
 test(`${group}: ${option} survives split runs and clears on deselection`,()=>{
  const checked=apply(original,{[group]:[option]});
  const paragraphs=[...parse(checked).getElementsByTagNameNS(NS,'p')];
  const matches=paragraphs.filter(p=>{const t=compact(text(p)).replace(/^[□■]/,'');const q=compact(option);return t===q||t.startsWith(q+'：')||t.startsWith(q+':')});
  assert.ok(matches.some(p=>text(p).includes('■')),`Missing checked option: ${option}`);
  const cleared=apply(checked,{});assert.equal((cleared.match(/■/g)||[]).length,0);
  assert.equal(checked.replace(/[□■]/g,''),new dom.window.XMLSerializer().serializeToString(parse(original)).replace(/[□■]/g,''),'Only checkbox glyphs may change');
 });
}
test('reported three selections export together without checking neighboring options',()=>{
 const selected={emotionalSupport:['個別關懷晤談'],environmentSupport:['需無障礙環境調整'],careerSupport:['生涯探索／討論']};
 const xml=apply(original,selected);assert.equal((xml.match(/■/g)||[]).length,3);
});
