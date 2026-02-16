"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button, Card, Field, InputField, Message, PageContainer } from "@/components/ui";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, nickname }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "회원가입에 실패했습니다.");
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
      <Card>
        <h1 className="section-title">회원가입</h1>
        <form className="list" onSubmit={onSubmit}>
          <Field label="이메일" htmlFor="email">
            <InputField id="email" name="email" type="email" value={email} onChange={setEmail} required />
          </Field>
          <Field label="닉네임 (선택)" htmlFor="nickname">
            <InputField id="nickname" name="nickname" value={nickname} onChange={setNickname} />
          </Field>
          <Field label="비밀번호" htmlFor="password">
            <InputField id="password" name="password" type="password" value={password} onChange={setPassword} required />
          </Field>
          <Button type="submit" disabled={isLoading}>{isLoading ? "가입 중..." : "회원가입"}</Button>
          {message ? <Message text={message} tone="error" /> : null}
        </form>
        <p className="message message-info" style={{ marginTop: 12 }}>
          이미 계정이 있다면 <Link href="/auth/signin">로그인</Link>
        </p>
      </Card>
    </PageContainer>
  );
}
