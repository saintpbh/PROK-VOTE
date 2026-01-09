'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface ResultsChartProps {
    approveCount: number;
    rejectCount: number;
    abstainCount: number;
    theme?: 'classic' | 'blue' | 'red';
}

export default function ResultsChart({
    approveCount,
    rejectCount,
    abstainCount,
    theme = 'classic',
}: ResultsChartProps) {
    const data = [
        { name: '찬성', value: approveCount, color: '#10B981' },
        { name: '반대', value: rejectCount, color: '#EF4444' },
        { name: '기권', value: abstainCount, color: '#6B7280' },
    ];

    const pieData = data.filter((d) => d.value > 0);

    const colors = {
        classic: ['#10B981', '#EF4444', '#6B7280'],
        blue: ['#3B82F6', '#EF4444', '#6B7280'],
        red: ['#DC2626', '#F97316', '#6B7280'],
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bar Chart */}
            <div className="bg-card/50 backdrop-blur-lg rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">투표 결과</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data}>
                        <XAxis dataKey="name" stroke="#fff" style={{ fontSize: '1.5rem', fontWeight: 'bold' }} />
                        <YAxis stroke="#fff" style={{ fontSize: '1.2rem' }} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1.2rem',
                            }}
                        />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="bg-card/50 backdrop-blur-lg rounded-2xl p-8">
                <h3 className="text-2xl font-bold mb-6 text-center">투표 비율</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                        <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) =>
                                `${name}: ${(percent * 100).toFixed(1)}%`
                            }
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(0,0,0,0.8)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1.2rem',
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '1.2rem' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
