import { useCallback, useEffect, useState } from 'react';
import { Search, Ban, CheckCircle, AlertTriangle, Users } from '../../components/icons';
import { Navbar } from '../../components/layout/Navbar';
import { ToastContainer } from '../../components/ui/Toast';
import { useNotifications } from '../../context/NotificationContext';
import { useEnsureWsAuth, useWs, useWsAuthReady, useWsConnected } from '../../context/WsContext';
import { adminListUsers, adminSetUserStatus } from '../../services/adminWs';
import type { AdminListUserRow } from '../../services/adminWsTypes';
import type { User, AccountStatus } from '../../types';
import { formatDate } from '../../utils/date';
import { humanizeWsBackendError } from '../../utils/wsBackendError';

function rowToUser(row: AdminListUserRow): User {
	const statusRaw = row.status;
	const status: AccountStatus =
		statusRaw === 'suspended' || statusRaw === 'banned' || statusRaw === 'active' ? statusRaw : 'active';
	const username =
		typeof row.username === 'string' ? row.username :
		row.email.includes('@') ? row.email.split('@')[0] ?? row.id :
		row.id;
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		username,
		avatar: row.avatar || '',
		role: row.role,
		createdAt: row.createdAt || '',
		isAgeVerified: true,
		status,
		walletBalanceMinor: '0',
	};
}

export function UserManagement() {
	const { showToast } = useNotifications();
	const ws = useWs();
	const wsConnected = useWsConnected();
	const wsAuthReady = useWsAuthReady();
	const ensureWsAuth = useEnsureWsAuth();

	const [users, setUsers] = useState<User[]>([]);
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState<'all' | 'fan' | 'creator' | 'admin'>('all');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned'>('all');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [totalMatching, setTotalMatching] = useState<number | null>(null);

	const loadPage = useCallback(async (cursor: string | null, append: boolean) => {
		if (!wsConnected) {
			setError('Not connected');
			setLoading(false);
			return;
		}
		try {
			await ensureWsAuth();
			if (append) setLoadingMore(true);
			else setLoading(true);
			setError(null);
			const res = await adminListUsers(ws, {
				q: search.trim() || undefined,
				role: roleFilter,
				status: statusFilter,
				limit: 30,
				cursor: cursor || undefined,
			});
			const mapped = res.items.map(rowToUser);
			setUsers(prev => append ? [...prev, ...mapped] : mapped);
			setNextCursor(res.nextCursor ?? null);
			if (typeof res.totalMatching === 'number') setTotalMatching(res.totalMatching);
		} catch (e) {
			const msg = humanizeWsBackendError(e instanceof Error ? e.message : 'Failed to load users');
			setError(msg);
			showToast(msg, 'error');
			if (!append) setUsers([]);
		} finally {
			setLoading(false);
			setLoadingMore(false);
		}
	}, [ensureWsAuth, roleFilter, search, showToast, statusFilter, ws, wsConnected]);

	useEffect(() => {
		if (!wsAuthReady && wsConnected) return;
		if (!wsConnected) {
			setLoading(false);
			setError('WebSocket disconnected');
			return;
		}
		const t = window.setTimeout(() => { void loadPage(null, false); }, search ? 300 : 0);
		return () => window.clearTimeout(t);
	}, [loadPage, roleFilter, statusFilter, search, wsAuthReady, wsConnected]);

	async function handleStatusChange(userId: string, newStatus: AccountStatus, reason?: string) {
		try {
			await ensureWsAuth();
			const parts = reason?.trim() ? reason.trim().split(/\s+/) : undefined;
			const res = await adminSetUserStatus(ws, userId, newStatus, parts);
			const u = res.user ? rowToUser(res.user as AdminListUserRow) : null;
			if (u) {
				setUsers(prev => prev.map(x => x.id === u.id ? u : x));
			} else {
				void loadPage(null, false);
			}
			showToast(`User ${newStatus === 'active' ? 'updated' : newStatus}`);
		} catch (e) {
			const msg = humanizeWsBackendError(e instanceof Error ? e.message : 'Failed to update user');
			showToast(msg, 'error');
		}
	}

	const statusColors = {
		active: 'bg-emerald-500/20 text-emerald-400',
		suspended: 'bg-amber-500/20 text-amber-400',
		banned: 'bg-rose-500/20 text-rose-400',
	};

	const roleColors = {
		fan: 'bg-blue-500/20 text-blue-400',
		creator: 'bg-rose-500/20 text-rose-400',
		admin: 'bg-foreground/10 text-muted',
	};

	const countLabel = totalMatching != null ? `${users.length} / ${totalMatching}` : `${users.length} users`;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<Navbar />
			<ToastContainer />
			<div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center gap-3">
						<Users className="w-5 h-5 text-rose-400" />
						<h1 className="text-xl font-bold text-foreground">User Management</h1>
					</div>
					<p className="text-muted text-sm">{countLabel}</p>
				</div>

				{error && !loading && (
					<div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
						{error}
					</div>
				)}

				<div className="flex flex-col gap-3 mb-4">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Search users by name or email..."
							className="w-full bg-input border border-border/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring/40"
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<div className="flex gap-1 bg-foreground/5 p-0.5 rounded-xl">
							{(['all', 'fan', 'creator', 'admin'] as const).map(r => (
								<button
									key={r}
									type="button"
									onClick={() => setRoleFilter(r)}
									className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
										roleFilter === r ? 'bg-foreground/10 text-foreground' : 'text-muted'
									}`}
								>
									{r}
								</button>
							))}
						</div>
						<div className="flex gap-1 bg-foreground/5 p-0.5 rounded-xl">
							{(['all', 'active', 'suspended', 'banned'] as const).map(s => (
								<button
									key={s}
									type="button"
									onClick={() => setStatusFilter(s)}
									className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
										statusFilter === s ? 'bg-foreground/10 text-foreground' : 'text-muted'
									}`}
								>
									{s}
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="bg-surface border border-border/20 rounded-2xl overflow-hidden">
					<div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-border/10">
						<p className="text-xs text-muted col-span-4">User</p>
						<p className="text-xs text-muted col-span-2 hidden sm:block">Role</p>
						<p className="text-xs text-muted col-span-2 hidden sm:block">Joined</p>
						<p className="text-xs text-muted col-span-2 hidden sm:block">Status</p>
						<p className="text-xs text-muted col-span-2">Actions</p>
					</div>

					{loading && users.length === 0 ? (
						<div className="px-4 py-10 text-center text-muted text-sm">Loading users…</div>
					) : (
						users.map(user => (
							<div key={user.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border/10 last:border-0 items-center">
								<div className="col-span-4 flex items-center gap-2 min-w-0">
									<img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
									<div className="min-w-0">
										<p className="text-sm font-medium text-foreground truncate">{user.name}</p>
										<p className="text-xs text-muted/80 truncate">{user.email}</p>
									</div>
								</div>
								<div className="col-span-2 hidden sm:block">
									<span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${roleColors[user.role]}`}>
										{user.role}
									</span>
								</div>
								<div className="col-span-2 hidden sm:block">
									<p className="text-xs text-muted">{user.createdAt ? formatDate(user.createdAt) : '—'}</p>
								</div>
								<div className="col-span-2 hidden sm:block">
									<span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[user.status]}`}>
										{user.status}
									</span>
								</div>
								<div className="col-span-2 sm:col-span-2 flex gap-1">
									{user.role !== 'admin' && (
										<>
											{user.status === 'active' ? (
												<button
													type="button"
													onClick={() => void handleStatusChange(user.id, 'suspended', 'admin action')}
													className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-colors"
													title="Suspend"
												>
													<AlertTriangle className="w-3.5 h-3.5" />
												</button>
											) : (
												<button
													type="button"
													onClick={() => void handleStatusChange(user.id, 'active')}
													className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors"
													title="Restore active"
												>
													<CheckCircle className="w-3.5 h-3.5" />
												</button>
											)}
											{user.status !== 'banned' ? (
												<button
													type="button"
													onClick={() => void handleStatusChange(user.id, 'banned', 'policy violation')}
													className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
													title="Ban"
												>
													<Ban className="w-3.5 h-3.5" />
												</button>
											) : (
												<button
													type="button"
													onClick={() => void handleStatusChange(user.id, 'active')}
													className="p-1.5 bg-foreground/5 hover:bg-foreground/10 text-muted rounded-lg transition-colors"
													title="Unban"
												>
													<CheckCircle className="w-3.5 h-3.5" />
												</button>
											)}
										</>
									)}
								</div>
							</div>
						))
					)}
				</div>

				{nextCursor && (
					<div className="mt-4 flex justify-center">
						<button
							type="button"
							disabled={loadingMore}
							onClick={() => void loadPage(nextCursor, true)}
							className="px-4 py-2 text-sm font-medium rounded-xl bg-foreground/10 text-foreground hover:bg-foreground/15 disabled:opacity-50"
						>
							{loadingMore ? 'Loading…' : 'Load more'}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
