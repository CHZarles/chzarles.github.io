import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { preloadNotePage } from "../navigation/preloaders";
import {
  noteDetailTransitionState,
  noteTitleTransitionName,
  preparePostTransitionOnClick,
} from "../navigation/transitions";

type HeadingTag = "h1" | "h2" | "h3" | "div" | "span";

type NoteLinkProps = {
  to: string;
  noteId: string;
  transitionTitle?: string;
  className?: string;
  titleClassName?: string;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onFocus?: React.FocusEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
};

export function NoteLink(props: NoteLinkProps) {
  const navigate = useNavigate();
  const state = React.useMemo(
    () => noteDetailTransitionState(props.noteId, { title: props.transitionTitle }),
    [props.noteId, props.transitionTitle],
  );

  const handleMouseEnter = React.useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      preloadNotePage();
      void api.prefetchNote(props.noteId);
      props.onMouseEnter?.(event);
    },
    [props.noteId, props.onMouseEnter],
  );

  const handleFocus = React.useCallback<React.FocusEventHandler<HTMLAnchorElement>>(
    (event) => {
      preloadNotePage();
      void api.prefetchNote(props.noteId);
      props.onFocus?.(event);
    },
    [props.noteId, props.onFocus],
  );

  const handleClickCapture = React.useCallback<React.MouseEventHandler<HTMLAnchorElement>>(
    (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

      preloadNotePage();
      void api.prefetchNote(props.noteId);
      preparePostTransitionOnClick(event);
      event.preventDefault();
      void api.note(props.noteId).catch(() => null).finally(() => {
        navigate(props.to, { state, viewTransition: true, flushSync: true });
      });
    },
    [navigate, props.noteId, props.to, state],
  );

  return (
    <Link
      to={props.to}
      state={state}
      onPointerDown={() => {
        preloadNotePage();
        void api.prefetchNote(props.noteId);
      }}
      onClickCapture={handleClickCapture}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      className={props.className}
    >
      {props.children}
    </Link>
  );
}

export function NoteTitleLink(props: NoteLinkProps & { as?: HeadingTag }) {
  const Tag = (props.as ?? "span") as HeadingTag;

  return (
    <NoteLink
      to={props.to}
      noteId={props.noteId}
      transitionTitle={props.transitionTitle}
      className={props.className}
      onMouseEnter={props.onMouseEnter}
      onFocus={props.onFocus}
    >
      <Tag className={props.titleClassName} style={{ display: "inline-block", viewTransitionName: noteTitleTransitionName(props.noteId) }}>
        {props.children}
      </Tag>
    </NoteLink>
  );
}
