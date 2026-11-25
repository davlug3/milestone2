type StartupLoader={stage:(message:string,done?:number,total?:number)=>void;ready:()=>void;fail:(message:string)=>void};
function current(){return (window as Window & {__startupLoader?:StartupLoader}).__startupLoader;}
export function loadingStage(message:string,done?:number,total?:number){current()?.stage(message,done,total);}
export function loadingReady(){current()?.ready();}
export function loadingFailed(error:unknown){current()?.fail(error instanceof Error?error.message:String(error));}
