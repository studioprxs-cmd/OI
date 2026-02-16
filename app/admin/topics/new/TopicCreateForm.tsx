"use client";

import { FormEvent, useState } from "react";

import { Button, Field, InputField, Message, SelectField, TextAreaField } from "@/components/ui";

const topicTypeOptions = [
  { value: "BETTING", label: "BETTING" },
  { value: "POLL", label: "POLL" },
] as const;

const statusOptions = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "OPEN", label: "OPEN" },
] as const;

export function TopicCreateForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [type, setType] = useState("BETTING");
  const [status, setStatus] = useState("DRAFT");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!title.trim() || !description.trim() || !closeAt) {
      setMessage("title, description, closeAt, type은 필수입니다.");
      return;
    }

    if (type !== "BETTING" && type !== "POLL") {
      setMessage("type은 BETTING 또는 POLL이어야 합니다.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/topics", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          closeAt: new Date(closeAt).toISOString(),
          status,
          type,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "토픽 생성에 실패했습니다.");
        return;
      }

      setMessage(`토픽 생성 완료: ${data.data.id}`);
      setTitle("");
      setDescription("");
      setCloseAt("");
      setType("BETTING");
      setStatus("DRAFT");
    } catch {
      setMessage("네트워크 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="list" onSubmit={onSubmit}>
      <Field label="타입" htmlFor="type">
        <SelectField id="type" name="type" value={type} onChange={setType} options={[...topicTypeOptions]} />
      </Field>
      <Field label="제목" htmlFor="title">
        <InputField id="title" name="title" value={title} onChange={setTitle} required placeholder="이슈 제목" />
      </Field>
      <Field label="설명" htmlFor="description">
        <TextAreaField
          id="description"
          name="description"
          value={description}
          onChange={setDescription}
          required
          placeholder="토픽 설명"
          rows={5}
        />
      </Field>
      <Field label="마감 시각" htmlFor="closeAt">
        <InputField id="closeAt" name="closeAt" type="datetime-local" value={closeAt} onChange={setCloseAt} required />
      </Field>
      <Field label="초기 상태" htmlFor="status">
        <SelectField id="status" name="status" value={status} onChange={setStatus} options={[...statusOptions]} />
      </Field>
      <Button type="submit" disabled={isLoading}>{isLoading ? "생성 중..." : "토픽 생성"}</Button>
      {message ? <Message text={message} tone={message.includes("실패") || message.includes("오류") ? "error" : "info"} /> : null}
    </form>
  );
}
