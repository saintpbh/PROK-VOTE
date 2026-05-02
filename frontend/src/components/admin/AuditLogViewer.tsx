'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AuditLogViewer() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        eventType: '',
        sessionId: '',
        voterId: '',
        limit: 100,
    });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await api.getAuditLogs(filters);
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
            toast.error('오딧 로그를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleExport = async () => {
        try {
            const csv = await api.exportAuditLogs(filters);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', `audit_logs_${new Date().toISOString()}.csv`);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            toast.error('내보내기에 실패했습니다.');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ko-KR');
    };

    return (
        <div className="card space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-primary">감사 로그 (Audit Logs)</h2>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLogs}
                        className="btn btn-secondary text-sm"
                        disabled={loading}
                    >
                        새로고침
                    </button>
                    <button
                        onClick={handleExport}
                        className="btn btn-primary text-sm"
                    >
                        CSV 내보내기
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                    <label className="text-xs font-semibold uppercase block mb-1">이벤트 타입</label>
                    <select
                        className="input w-full"
                        value={filters.eventType}
                        onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
                    >
                        <option value="">모두</option>
                        <option value="USER_LOGIN_SUCCESS">로그인 성공</option>
                        <option value="VOTER_AUTHENTICATED">유권자 인증</option>
                        <option value="VOTE_CAST">투표 행사</option>
                        <option value="ADMIN_UPDATE_STAGE">상태 변경</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase block mb-1">세션 ID</label>
                    <input
                        className="input w-full"
                        placeholder="UUID..."
                        value={filters.sessionId}
                        onChange={(e) => setFilters({ ...filters, sessionId: e.target.value })}
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold uppercase block mb-1">한도</label>
                    <input
                        type="number"
                        className="input w-full"
                        value={filters.limit}
                        onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                    />
                </div>
                <div className="flex items-end">
                    <button onClick={fetchLogs} className="btn btn-primary w-full py-2">검색</button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">시간</th>
                            <th className="px-4 py-3">이벤트</th>
                            <th className="px-4 py-3">관련 ID</th>
                            <th className="px-4 py-3">IP 주소</th>
                            <th className="px-4 py-3">내용</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-8">로딩 중...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">로그가 없습니다.</td></tr>
                        ) : logs.map((log) => (
                            <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${log.eventType.includes('VOTE') ? 'bg-green-100 text-green-700' :
                                            log.eventType.includes('ADMIN') ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                        }`}>
                                        {log.eventType}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-[10px]">
                                    {log.sessionId && `Session: ${log.sessionId.substring(0, 8)}...`}<br />
                                    {log.voterId && `Voter: ${log.voterId.substring(0, 8)}...`}
                                </td>
                                <td className="px-4 py-3 text-xs">{log.ipAddress || '-'}</td>
                                <td className="px-4 py-3 text-xs max-w-xs truncate">
                                    {JSON.stringify(log.eventData)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
