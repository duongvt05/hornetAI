"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Bug } from 'lucide-react';

export default function LoginForm() {
  const [tab, setTab]             = useState<'login' | 'register'>('login');
  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Login state
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  // Register state
  const [regData, setRegData] = useState({
    username: '', password: '', confirm: '', full_name: '', role: 'worker'
  });

  const { login, register } = useAuth();
  const { toast }           = useToast();
  const router              = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.username || !loginData.password) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập đầy đủ thông tin', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await login(loginData.username, loginData.password);
      router.push('/dashboard');
    } catch (err: any) {
      toast({ title: 'Đăng nhập thất bại', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.username || !regData.password || !regData.full_name) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập đầy đủ thông tin', variant: 'destructive' });
      return;
    }
    if (regData.password !== regData.confirm) {
      toast({ title: 'Lỗi', description: 'Mật khẩu không khớp', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      await register({ username: regData.username, password: regData.password, full_name: regData.full_name, role: regData.role });
      toast({ title: 'Đăng ký thành công', description: 'Bạn có thể đăng nhập ngay bây giờ' });
      setTab('login');
      setLoginData({ username: regData.username, password: '' });
    } catch (err: any) {
      toast({ title: 'Đăng ký thất bại', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
          <Bug className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold">HornetAI</h1>
        <p className="text-sm text-muted-foreground mt-1">Hệ thống giám sát ong thông minh</p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-muted p-1 mb-6">
        <button
          onClick={() => setTab('login')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'login' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          Đăng nhập
        </button>
        <button
          onClick={() => setTab('register')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'register' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          Đăng ký
        </button>
      </div>

      {/* LOGIN FORM */}
      {tab === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Tên đăng nhập</label>
            <input
              type="text"
              value={loginData.username}
              onChange={e => setLoginData(d => ({ ...d, username: e.target.value }))}
              placeholder="admin"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={loginData.password}
                onChange={e => setLoginData(d => ({ ...d, password: e.target.value }))}
                placeholder="••••••"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors pr-10"
                disabled={isLoading}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang đăng nhập...</> : 'Đăng nhập'}
          </button>
        </form>
      )}

      {/* REGISTER FORM */}
      {tab === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1.5">Họ và tên</label>
            <input
              type="text"
              value={regData.full_name}
              onChange={e => setRegData(d => ({ ...d, full_name: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Tên đăng nhập</label>
            <input
              type="text"
              value={regData.username}
              onChange={e => setRegData(d => ({ ...d, username: e.target.value }))}
              placeholder="username (ít nhất 3 ký tự)"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1.5">Mật khẩu</label>
              <input
                type="password"
                value={regData.password}
                onChange={e => setRegData(d => ({ ...d, password: e.target.value }))}
                placeholder="Ít nhất 6 ký tự"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Xác nhận</label>
              <input
                type="password"
                value={regData.confirm}
                onChange={e => setRegData(d => ({ ...d, confirm: e.target.value }))}
                placeholder="Nhập lại"
                className={`w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-colors ${
                  regData.confirm && regData.password !== regData.confirm
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-border focus:border-amber-500'
                }`}
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Vai trò</label>
            <select
              value={regData.role}
              onChange={e => setRegData(d => ({ ...d, role: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-colors"
              disabled={isLoading}
            >
              <option value="worker">Worker (Nhân viên)</option>
              <option value="admin">Admin (Quản trị)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isLoading || (!!regData.confirm && regData.password !== regData.confirm)}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo tài khoản...</> : 'Tạo tài khoản'}
          </button>
        </form>
      )}
    </div>
  );
}