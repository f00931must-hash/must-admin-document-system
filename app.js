const {SEMESTER_ISP_TEMPLATE_B64}=await import("./templates/semester-template-data/index.js?v=2.1.0");
const OLD_ISP_AI="https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary";
const NEW_ISP_AI="https://must-isp-ai-697793258377.asia-east1.run.app/ai/isp-summary";
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  try{
    const rawUrl=typeof input==="string"?input:(input instanceof URL?input.href:(input instanceof Request?input.url:""));
    if(rawUrl.includes("templates/semester-isp-template-v2.docx")){
      const binary=atob(SEMESTER_ISP_TEMPLATE_B64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return Promise.resolve(new Response(bytes,{status:200,headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Cache-Control":"no-store"}}));
    }
    if(typeof input==="string"&&input===OLD_ISP_AI)return nativeFetch(NEW_ISP_AI,init);
    if(input instanceof URL&&input.href===OLD_ISP_AI)return nativeFetch(new URL(NEW_ISP_AI),init);
    if(input instanceof Request&&input.url===OLD_ISP_AI)return nativeFetch(new Request(NEW_ISP_AI,input),init);
  }catch(error){console.warn("ISP route fallback",error);}
  return nativeFetch(input,init);
};
await import("./app-core.js?v=1.6.19");
await import("./admin-doc-cache.js?v=1.0.0");
await import("./isp-autosave-hotfix.js?v=1.1.1");
await import("./isp-structure-enhancements.js?v=2.0.7");
await import("./isp-ui-filters-support-v2.1.js?v=2.1.5");
await import("./semester-isp-grade-8-fix.js?v=1.0.0");
await import("./semester-isp-list-actions-v1.js?v=1.3.0");
await import("./semester-isp-term-storage-fix.js?v=2.2.6");
await import("./semester-isp-checkbox-export-fix.js?v=2.4.1");
await import("./semester-isp-checkbox-value-guard.js?v=2.4.0");
await import("./semester-isp-term-navigator-v1.js?v=1.0.0");
await import("./semester-teacher-summary.js?v=1.2.0");
await import("./isp-receipt-combined.js?v=0.2.0");