import { useState } from 'react';
import { Search, Users, MessageCircle } from '../../components/icons';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { useCurrentCreator } from '../../context/AuthContext';
import { mockCreators, mockUsers } from '../../data/users';
import { mockSubscriptions } from '../../data/transactions';
import { formatDate } from '../../utils/date';
import { useChat } from '../../context/ChatContext';

export function Subscribers() {
	const creator = useCurrentCreator();
	const navigate = useNavigate();
	const { addConversation, state: chatState } = useChat();
	const [search, setSearch] = useState('');

	const creatorData = creator ?? mockCreators[0];
	const creatorSubs = mockSubscriptions.filter(s => s.creatorId === creatorData.id && s.isActive);

	const subscribers = creatorSubs.map(sub => {
		const user = mockUsers.find(u => u.id === sub.userId);
		return { ...sub, user };
	}).filter(s => {
		if (!search) return true;
		return s.user?.name.toLowerCase().includes(search.toLowerCase()) ||
			s.user?.username?.toLowerCase().includes(search.toLowerCase());
	});

	function handleMessage(userId: string, userName: string, userAvatar: string) {
		const existing = chatState.conversations.find(c =>
			c.participantIds.includes(creatorData.id) && c.participantIds.includes(userId)
		);
		if (existing) {
			navigate(`/messages/${existing.id}`);
		} else {
			const convId = `conv-${Date.now()}`;
			addConversation({
				id: convId,
				participantIds: [creatorData.id, userId],
				participantNames: [creatorData.name, userName],
				participantAvatars: [creatorData.avatar, userAvatar],
				lastMessage: '',
				lastMessageTime: new Date().toISOString(),
				unreadCount: 0,
				isOnline: false,
			});
			navigate(`/messages/${convId}`);
		}
	}

	return (
		<Layout>
			<div className="max-w-4xl mx-auto px-4 py-6">
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-xl font-bold text-white">Subscribers</h1>
						<p className="text-white/40 text-sm">{creatorData.subscriberCount.toLocaleString()} total</p>
					</div>
				</div>

				<div className="grid grid-cols-3 gap-3 mb-6">
					<div className="bg-[#161616] border border-white/5 rounded-2xl p-4 text-center">
						<p className="text-2xl font-black text-white">{creatorData.subscriberCount}</p>
						<p className="text-xs text-white/40">Total Subscribers</p>
					</div>
					<div className="bg-[#161616] border border-white/5 rounded-2xl p-4 text-center">
						<p className="text-2xl font-black text-emerald-400">{creatorSubs.length}</p>
						<p className="text-xs text-white/40">Active</p>
					</div>
					<div className="bg-[#161616] border border-white/5 rounded-2xl p-4 text-center">
						<p className="text-2xl font-black text-rose-400">${(creatorSubs.reduce((s, sub) => s + sub.price, 0)).toFixed(2)}</p>
						<p className="text-xs text-white/40">MRR</p>
					</div>
				</div>

				<div className="relative mb-4">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
					<input
						value={search}
						onChange={e => setSearch(e.target.value)}
						placeholder="Search subscribers..."
						className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-rose-500/30"
					/>
				</div>

				<div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
					{subscribers.length === 0 ? (
						<div className="text-center py-10">
							<Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
							<p className="text-white/30 text-sm">No subscribers found</p>
						</div>
					) : (
						subscribers.map((sub, idx) => (
							<div key={sub.id} className={`flex items-center gap-3 px-4 py-3 ${idx < subscribers.length - 1 ? 'border-b border-white/5' : ''}`}>
								{sub.user ? (
									<img src={sub.user.avatar} alt={sub.user.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
								) : (
									<div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
								)}
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium text-white truncate">{sub.user?.name ?? 'Unknown'}</p>
									<p className="text-xs text-white/40 truncate">
										Subscribed {formatDate(sub.startDate)} · ${sub.price}/mo
									</p>
								</div>
								<button
									onClick={() => sub.user && handleMessage(sub.user.id, sub.user.name, sub.user.avatar)}
									className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs px-3 py-1.5 rounded-xl transition-colors shrink-0"
								>
									<MessageCircle className="w-3.5 h-3.5" />
									Message
								</button>
							</div>
						))
					)}
				</div>
			</div>
		</Layout>
	);
}
