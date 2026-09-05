const OLD_ISP_AI="https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary";
const NEW_ISP_AI="https://must-isp-ai-697793258377.asia-east1.run.app/ai/isp-summary";
const nativeFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  try{
    if(typeof input==="string"&&input===OLD_ISP_AI)return nativeFetch(NEW_ISP_AI,init);
    if(input instanceof URL&&input.href===OLD_ISP_AI)return nativeFetch(new URL(NEW_ISP_AI),init);
    if(input instanceof Request&&input.url===OLD_ISP_AI)return nativeFetch(new Request(NEW_ISP_AI,input),init);
  }catch(error){console.warn("ISP AI route fallback",error);}
  return nativeFetch(input,init);
};
await import("./app-core.js?v=1.3.4");
await import("./isp-autosave-hotfix.js?v=1.0.1");
