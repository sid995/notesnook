import React, { useMemo } from "react";
import { Flex, Text } from "rebass";
import * as Icon from "../icons";
import TimeAgo from "timeago-react";
import ListItem from "../list-item";
import { showMoveNoteDialog } from "../../common/dialog-controller";
import { store, useStore } from "../../stores/note-store";
import { db } from "../../common/db";
import Colors from "../menu/colors";
import { showExportDialog } from "../../common/dialog-controller";
import { showItemDeletedToast } from "../../common/toasts";
import { showUnpinnedToast } from "../../common/toasts";
import { showToast } from "../../utils/toast";
import { hashNavigate, navigate } from "../../navigation";
import { showPublishView } from "../publish-view";
import Vault from "../../common/vault";
import IconTag from "../icon-tag";

function Note(props) {
  const { tags, item, index, context } = props;
  const note = item;
  const selectedNote = useStore((store) => store.selectedNote);
  const viewMode = useStore((store) => store.viewMode);
  const isOpened = selectedNote === note.id;

  const primary = useMemo(() => {
    if (!note.color) return "primary";
    return note.color.toLowerCase();
  }, [note.color]);

  const notebook = useMemo(() => {
    if (!note.notebooks?.length) return;
    const firstNotebook = note.notebooks[0];
    const notebook = db.notebooks.notebook(firstNotebook.id)?.data;
    return notebook;
  }, [note.notebooks]);

  return (
    <ListItem
      selectable
      isFocused={isOpened}
      isCompact={viewMode === "compact"}
      item={note}
      title={note.title}
      body={note.headline}
      id={note.id}
      index={index}
      colors={{
        primary,
        text: note.color ? primary : "text",
        background: isOpened ? "bgSecondary" : "background",
      }}
      menu={{
        items: context?.type === "topic" ? topicNoteMenuItems : menuItems,
        extraData: { note, context },
      }}
      onClick={() => {
        if (note.conflicted) {
          hashNavigate(`/notes/${note.id}/conflict`, { replace: true });
        } else if (note.locked) {
          hashNavigate(`/notes/${note.id}/unlock`, { replace: true });
        } else {
          hashNavigate(`/notes/${note.id}/edit`, { replace: true });
        }
      }}
      header={
        (tags?.length || notebook) && (
          <Flex alignSelf="flex-start" justifySelf="flex-start" mb={1}>
            {notebook && (
              <IconTag
                onClick={() => {
                  navigate(`/notebooks/${notebook.id}/`);
                }}
                text={notebook.title}
                icon={Icon.Notebook}
              />
            )}
            {tags?.slice(0, 2).map((tag) => {
              const tagItem = db.tags.tag(tag);
              if (!tagItem) return null;
              return (
                <IconTag
                  key={tagItem.id}
                  text={db.tags.alias(tagItem.id)}
                  icon={Icon.Tag}
                  onClick={() => {
                    if (!tagItem.id) return showToast("Tag not found.");
                    navigate(`/tags/${tagItem.id}`);
                  }}
                />
              );
            })}
          </Flex>
        )
      }
      footer={
        <Flex
          alignItems="center"
          sx={{
            fontSize: "subBody",
            color: isOpened ? "bgSecondaryText" : "fontTertiary",
          }}
        >
          {note.conflicted && (
            <Text
              display="flex"
              mr={1}
              fontSize="subBody"
              color="error"
              fontWeight="bold"
              sx={{ borderRadius: "default" }}
            >
              <Icon.Alert size={15} color="error" sx={{ mr: "2px" }} />{" "}
              Conflicted
            </Text>
          )}
          <TimeAgo
            live={false}
            datetime={note.dateCreated}
            style={{ marginRight: 5 }}
          />
          {note.pinned && !props.context && (
            <Icon.Pin size={13} color={primary} sx={{ mr: 1 }} />
          )}
          {note.locked && (
            <Icon.Lock
              size={13}
              color={"fontTertiary"}
              sx={{ mr: 1 }}
              data-test-id={`note-${index}-locked`}
            />
          )}
          {note.favorite && (
            <Icon.Star color={primary} size={15} sx={{ mr: 1 }} />
          )}
        </Flex>
      }
    />
  );
}

export default React.memo(Note, function (prevProps, nextProps) {
  const prevItem = prevProps.item;
  const nextItem = nextProps.item;
  return (
    prevItem.pinned === nextItem.pinned &&
    prevItem.favorite === nextItem.favorite &&
    prevItem.headline === nextItem.headline &&
    prevItem.title === nextItem.title &&
    prevItem.locked === nextItem.locked &&
    prevItem.conflicted === nextItem.conflicted &&
    prevItem.color === nextItem.color &&
    JSON.stringify(prevProps.notebooks) ===
      JSON.stringify(nextProps.notebooks) &&
    JSON.stringify(prevProps.tags) === JSON.stringify(nextProps.tags)
  );
});

const pin = (note) => {
  return store
    .pin(note.id)
    .then(async () => {
      if (note.pinned) await showUnpinnedToast(note.id, "note");
    })
    .catch((error) => showToast("error", error.message));
};

const menuItems = [
  {
    key: "colors",
    title: () => "Colors",
    component: ({ data }) => <Colors note={data.note} />,
  },
  {
    key: "publish",
    disabled: ({ note }) => !db.monographs.isPublished(note.id) && note.locked,
    disableReason: "You cannot publish a locked note.",
    icon: Icon.Publish,
    title: ({ note }) =>
      db.monographs.isPublished(note.id) ? "Unpublish" : "Publish",
    onClick: async ({ note }) => {
      await showPublishView(note.id, "bottom");
    },
  },
  {
    key: "addtonotebook",
    title: () => "Add to notebook(s)",
    icon: Icon.AddToNotebook,
    onClick: async ({ note }) => {
      await showMoveNoteDialog([note.id]);
    },
  },
  {
    key: "pin",
    title: ({ note }) => (note.pinned ? "Unpin" : "Pin"),
    icon: Icon.Pin,
    onClick: async ({ note }) => {
      await pin(note);
    },
  },
  {
    key: "favorite",
    title: ({ note }) => (note.favorite ? "Unfavorite" : "Favorite"),
    icon: Icon.StarOutline,
    onClick: ({ note }) => store.favorite(note),
  },
  {
    key: "export",
    title: () => "Export",
    icon: Icon.Export,
    onClick: async ({ note }) => {
      if (note.locked) {
        alert("Locked notes cannot be exported currently.");
        return;
      }
      if (await showExportDialog([note.id]))
        showToast("success", `Note exported successfully!`);
    },
    isPro: true,
  },
  {
    key: "unlocknote",
    title: ({ note }) => (note.locked ? "Unlock" : "Lock"),
    icon: Icon.Lock,
    onClick: async ({ note }) => {
      const { unlock, lock } = store.get();
      if (!note.locked) {
        if (await lock(note.id))
          showToast("success", "Note locked successfully!");
      } else {
        if (await unlock(note.id))
          showToast("success", "Note unlocked successfully!");
      }
    },
    isPro: true,
  },
  {
    key: "movetotrash",
    title: () => "Move to trash",
    color: "red",
    icon: Icon.Trash,
    disabled: ({ note }) => db.monographs.isPublished(note.id),
    disableReason: "Please unpublish this note to move it to trash",
    onClick: async ({ note }) => {
      if (note.locked) {
        if (!(await Vault.unlockNote(note.id))) return;
      }
      await store.delete(note.id).then(() => showItemDeletedToast(note));
    },
  },
];

const topicNoteMenuItems = [
  ...menuItems,
  {
    key: "removefromtopic",
    title: () => "Remove from topic",
    icon: Icon.TopicRemove,
    color: "red",
    onClick: async ({ note, context }) => {
      await db.notebooks
        .notebook(context.value.id)
        .topics.topic(context.value.topic)
        .delete(note.id);
      store.refresh();
      await showToast("success", "Note removed from topic!");
    },
  },
];
