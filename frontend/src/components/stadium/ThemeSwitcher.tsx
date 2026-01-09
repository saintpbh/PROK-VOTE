'use client';

interface ThemeSwitcherProps {
    currentTheme: 'classic' | 'blue' | 'red';
    onThemeChange: (theme: 'classic' | 'blue' | 'red') => void;
}

export default function ThemeSwitcher({ currentTheme, onThemeChange }: ThemeSwitcherProps) {
    const themes = [
        { id: 'classic' as const, name: 'Classic', color: 'from-purple-600 to-amber-500' },
        { id: 'blue' as const, name: 'Blue', color: 'from-blue-600 to-sky-400' },
        { id: 'red' as const, name: 'Red', color: 'from-red-600 to-orange-500' },
    ];

    return (
        <div className="fixed top-4 right-4 flex gap-2 z-50">
            {themes.map((theme) => (
                <button
                    key={theme.id}
                    onClick={() => onThemeChange(theme.id)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all ${currentTheme === theme.id
                            ? `bg-gradient-to-r ${theme.color} text-white scale-110 shadow-lg`
                            : 'bg-card/50 text-muted-foreground hover:bg-card'
                        }`}
                >
                    {theme.name}
                </button>
            ))}
        </div>
    );
}
