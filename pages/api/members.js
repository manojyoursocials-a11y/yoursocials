// pages/api/members.js
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/auth';
import { getDb } from '../../lib/db';
export default async function handler(req,res){
  const session=await getServerSession(req,res,authOptions);
  if(!session) return res.status(401).json({error:'Unauthorized'});
  const db=getDb();
  if(req.method==='GET') return res.json(db.getMembers());
  if(req.method==='PATCH'){db.updateUser(session.user.id,{job_title:req.body.job_title||null,role:req.body.role||'member'});return res.json({ok:true});}
  res.status(405).end();
}
