import React from "react";
import { Link } from "react-router-dom";
import {
  noteDetailTransitionState,
  noteTitleTransitionName,
  preparePostTransitionOnClick,
} from "../navigation/transitions";

type HeadingTag = "h1" | "h2" | "h3" | "div" | "span";

export function NoteTitleLink(props: {
  to: string;
  noteId: string;
  transitionTitle?: string;
  className?: string;
  titleClassName?: string;
  as?: HeadingTag;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onFocus?: React.FocusEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
}) {
  const Tag = (props.as ?? "span") as HeadingTag;

  return (
    <Link
      to={props.to}
      state={noteDetailTransitionState(props.noteId, { title: props.transitionTitle })}
      viewTransition
      onClickCapture={preparePostTransitionOnClick}
      onMouseEnter={props.onMouseEnter}
      onFocus={props.onFocus}
      className={props.className}
    >
      <Tag className={props.titleClassName} style={{ viewTransitionName: noteTitleTransitionName(props.noteId) }}>
        {props.children}
      </Tag>
    </Link>
  );
}
