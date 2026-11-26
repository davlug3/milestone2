import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {validateSlides} from '../../stats/src/model.js';
export function readStatsConfig(file){
 const r=ts.parseConfigFileTextToJson(file,readFileSync(file,'utf8'));
 if(r.error)throw Error(ts.flattenDiagnosticMessageText(r.error.messageText,'\n'));
 return validateSlides(r.config?.stats?.slides);
}
export function statsConfigPlugin(file){
 const id='virtual:milestone-stats', resolved='\0'+id;
 return {name:'milestone-stats-config',resolveId(x){if(x===id)return resolved},load(x){if(x===resolved){this.addWatchFile(file);return 'export default '+JSON.stringify(readStatsConfig(file));}},configureServer(server){server.watcher.add(file);},handleHotUpdate(ctx){if(ctx.file===file){const m=ctx.server.moduleGraph.getModuleById(resolved);if(m)ctx.server.moduleGraph.invalidateModule(m);ctx.server.ws.send({type:'full-reload'});return []}}};
}
