import React from 'react';
import { ForumPost, UserTier } from '../types';
import { FORUM_POSTS } from '../data/staticData';
import { MessageSquare, Heart, Lock, Users, Shield } from 'lucide-react';

interface Props {
  userTier: UserTier;
}

const Community: React.FC<Props> = ({ userTier }) => {
  // Community requires EMAIL_SUBSCRIBER or higher
  const isPublic = userTier === UserTier.PUBLIC;

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <h2 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Community Signal</h2>
          <p className="text-xl text-gray-400 font-light">
             Connect with other conductors in the ether.
          </p>
        </div>
        {isPublic && (
           <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-symphony-amber/10 border border-symphony-amber/20 text-symphony-amber text-xs font-bold uppercase tracking-widest">
               <Lock size={14} /> Sign Up Free
           </div>
        )}
      </div>

      <div className="grid gap-6">
        {FORUM_POSTS.map((post) => (
          <div key={post.id} className="bg-symphony-charcoal border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors relative overflow-hidden">
             
             {/* Header */}
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${post.tier === UserTier.OWNER ? 'bg-symphony-amber text-black' : 'bg-white/10 text-white'}`}>
                        {post.author[0]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold">{post.author}</span>
                            {post.tier === UserTier.OWNER && <Shield size={14} className="text-symphony-amber" />}
                        </div>
                        <span className="text-gray-500 text-xs">{post.date}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    {post.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 rounded text-[10px] font-mono uppercase bg-white/5 text-gray-400">
                            {tag}
                        </span>
                    ))}
                </div>
             </div>

             {/* Content */}
             <div className="mb-6">
                 <h3 className="text-xl font-bold text-white mb-2">{post.title}</h3>
                 
                 {/* Paywall Blur Logic */}
                 <div className={`text-gray-400 relative ${isPublic ? 'h-20 overflow-hidden' : ''}`}>
                     <p>{post.content}</p>
                     {isPublic && (
                         <div className="absolute inset-0 bg-gradient-to-b from-transparent to-symphony-charcoal flex items-end justify-center pb-2">
                             <div className="flex items-center gap-2 text-symphony-amber text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full bg-black border border-symphony-amber shadow-2xl z-10">
                                 <Lock size={12} /> Free Account Required
                             </div>
                         </div>
                     )}
                 </div>
             </div>

             {/* Footer Actions */}
             <div className="flex items-center gap-6 pt-4 border-t border-white/5 text-gray-500 text-sm">
                 <button disabled={isPublic} className={`flex items-center gap-2 transition-colors ${isPublic ? 'cursor-not-allowed opacity-50' : 'hover:text-red-500'}`}>
                     <Heart size={18} /> {post.likes}
                 </button>
                 <button disabled={isPublic} className={`flex items-center gap-2 transition-colors ${isPublic ? 'cursor-not-allowed opacity-50' : 'hover:text-white'}`}>
                     <MessageSquare size={18} /> {post.comments} Comments
                 </button>
                 {isPublic && (
                     <span className="ml-auto text-xs text-gray-600 font-mono uppercase">Sign up free to join</span>
                 )}
             </div>

          </div>
        ))}
      </div>

      {/* New Post Input (Disabled for PUBLIC) */}
      <div className={`mt-8 p-6 rounded-2xl border border-white/5 bg-white/[0.02] ${isPublic ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex gap-4">
             <div className="w-10 h-10 rounded-full bg-gray-800" />
             <div className="flex-grow">
                 <input
                    type="text"
                    placeholder={isPublic ? "Sign up free to start a discussion..." : "Start a discussion..."}
                    disabled={isPublic}
                    className="w-full bg-transparent border-b border-white/10 pb-2 text-white focus:border-symphony-amber outline-none"
                 />
             </div>
          </div>
      </div>

    </div>
  );
};

export default Community;