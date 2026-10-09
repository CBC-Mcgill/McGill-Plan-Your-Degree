export const PROFILE_STORAGE_KEY = "plan-your-degree:profile";

/** Runs in <head> before the first paint, so a returning student gets `data-returning` and `/` shows the dashboard skeleton instead of the landing. Mirrors `isStarted`. */
export const FIRST_PAINT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(PROFILE_STORAGE_KEY)})||"null");s=s&&s.state;var d=document.documentElement;if(s&&((s.records&&s.records.length)||(s.plan&&s.plan.length)||s.programId!=null||s.startTerm!=null))d.dataset.returning=""}catch(e){}`;
