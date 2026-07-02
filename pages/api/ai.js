import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
const SYSTEM=`You are the AI Operations Manager for "Your Socials OS", a creative social media agency in Chennai. Help teams break tasks into subtasks, predict deadline risks, suggest collaborations, draft client follow-ups. Be concise, warm, practical.`;
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const session=await getServerSession(req,res,authOptions);
  if(!session) return res.status(401).json({error:'Unauthorized'});
  const{prompt}=req.body;
  if(!prompt) return res.status(400).json({error:'Prompt required'});
  if(!process.env.ANTHROPIC_API_KEY) return res.json({text:'⚠️ Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.'});
  try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1024,system:SYSTEM,messages:[{role:'user',content:prompt}]})});
    const data=await r.json();
    if(data.error) return res.status(500).json({error:data.error.message});
    return res.json({text:data.content?.[0]?.text??''});
  }catch(e){return res.status(500).json({error:e.message});}
}
