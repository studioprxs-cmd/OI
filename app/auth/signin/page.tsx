"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button, Card, Field, InputField, Message, OiBadge, PageContainer } from "@/components/ui";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "로그인에 실패했습니다.");
        return;
      }

      router.refresh();
      router.push("/");
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageContainer>
      <section className="auth-layout">
        <Card>
          <div className="auth-card-head">
            <OiBadge label="OI Auth" />
            <span className="auth-step">Sign in</span>
          </div>
          <div className="auth-logo-wrap" aria-hidden>
            <Image src="/oi-logo.jpg" alt="" width={220} height={72} className="auth-logo" priority />
          </div>
          <h1 className="section-title">로그인</h1>
          <p className="auth-sub">계정으로 로그인하고 실시간 이슈 참여를 이어가세요.</p>
          <form className="list" onSubmit={onSubmit}>
            <Field label="이메일" htmlFor="email">
              <InputField id="email" name="email" type="email" value={email} onChange={setEmail} required />
            </Field>
            <Field label="비밀번호" htmlFor="password">
              <InputField id="password" name="password" type="password" value={password} onChange={setPassword} required />
            </Field>
            <p className="helper-text">공용 기기에서는 자동 로그인 사용을 피해주세요.</p>
            <Button type="submit" disabled={isLoading}>{isLoading ? "로그인 중..." : "로그인"}</Button>
            {message ? <Message text={message} tone="error" /> : <Message text="로그인 후 홈에서 바로 참여할 수 있어요." tone="info" />}
          </form>
          <p className="message message-info" style={{ marginTop: 12 }}>
            계정이 없다면 <Link href="/auth/signup">회원가입</Link>
          </p>
        </Card>
      </section>
    </PageContainer>
  );
}
