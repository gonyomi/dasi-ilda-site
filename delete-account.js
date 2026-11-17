// 웹 계정 삭제(Google Play 요구, PLAN 13번). 앱과 같은 방법: 이메일 6자리 코드로 본인 확인 →
// 서버 delete-account 함수(사용자 토큰으로 본인만 지움). 새 계정은 만들지 않는다(shouldCreateUser: false).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const $ = (id) => document.getElementById(id);
const steps = ['step-email', 'step-code', 'step-confirm', 'step-done'];
let email = '';

function show(step) {
  for (const id of steps) $(id).hidden = id !== step;
}

function say(text, isError = false) {
  $('message').textContent = text;
  $('message').className = isError ? 'message error' : 'message';
}

function busy(button, value) {
  button.disabled = value;
}

/** Supabase 오류를 안내 문구로. 앱의 authErrorKey와 같은 기준이다. */
function authMessage(error) {
  const status = error?.status;
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '').toLowerCase();
  if (status === 429 || code.includes('rate_limit')) return '요청이 너무 잦아요. 1분쯤 뒤에 다시 해 주세요.';
  if (code === 'otp_expired' || message.includes('expired or is invalid')) {
    return '코드가 틀렸거나 시간이 지났어요. 코드를 다시 받아 주세요.';
  }
  if (code === 'otp_disabled' || message.includes('signups not allowed')) {
    return '이 이메일로 가입된 계정이 없어요. 이메일을 다시 확인해 주세요.';
  }
  if (message.includes('fetch') || message.includes('network')) return '인터넷 연결을 확인해 주세요.';
  return '처리하지 못했어요. 잠시 뒤 다시 해 주세요.';
}

$('send').addEventListener('click', async () => {
  const value = $('email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    say('이메일 주소를 다시 확인해 주세요.', true);
    return;
  }
  busy($('send'), true);
  say('');
  const { error } = await supabase.auth.signInWithOtp({
    email: value,
    options: { shouldCreateUser: false },
  });
  busy($('send'), false);
  if (error) {
    say(authMessage(error), true);
    return;
  }
  email = value;
  $('sent-to').textContent = `${email}로 6자리 코드를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.`;
  $('code').value = '';
  show('step-code');
});

$('back').addEventListener('click', () => {
  say('');
  show('step-email');
});

$('verify').addEventListener('click', async () => {
  const token = $('code').value.replace(/\D/g, '').slice(0, 6);
  if (token.length !== 6) {
    say('6자리 숫자를 넣어 주세요.', true);
    return;
  }
  busy($('verify'), true);
  say('');
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  busy($('verify'), false);
  if (error) {
    say(authMessage(error), true);
    return;
  }
  $('confirm-email').textContent = `${email} 계정과 서버에 백업한 기록이 모두 지워지고 되돌릴 수 없어요.`;
  show('step-confirm');
});

$('delete').addEventListener('click', async () => {
  busy($('delete'), true);
  say('');
  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
  busy($('delete'), false);
  const status = error?.context?.status;
  if (!error && data?.deleted === true) {
    await supabase.auth.signOut({ scope: 'local' });
    say('');
    show('step-done');
    return;
  }
  if (status === 401) {
    say('확인이 끝났어요. 처음부터 다시 해 주세요(이미 삭제됐을 수도 있어요).', true);
    show('step-email');
    return;
  }
  say(
    error?.name === 'FunctionsFetchError'
      ? '인터넷 연결을 확인하고 다시 해 주세요. 아직 아무것도 지우지 않았어요.'
      : '계정을 삭제하지 못했어요. 잠시 뒤 다시 해 주세요. 아직 아무것도 지우지 않았어요.',
    true,
  );
});
