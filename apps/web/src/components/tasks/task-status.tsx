import type { TaskStatus } from "@roster/api";
import { getStatusColor } from "@roster/ui";

export interface StatusIconProps {
  size?: number;
  className?: string;
  color?: string;
}

function TodoIcon({ size = 18, className, color }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.72875 2.25H10.2712C11.9873 2.25 13.2694 2.55779 14.3522 3.13682C15.422 3.70311 16.2969 4.57798 16.8632 5.64782C17.4422 6.73061 17.75 8.01268 17.75 9.72875V10.2712C17.75 11.9873 17.4422 13.2694 16.8632 14.3522C16.2969 15.422 15.422 16.2969 14.3522 16.8632C13.2694 17.4422 11.9873 17.75 10.2712 17.75H9.72875C8.01268 17.75 6.73061 17.4422 5.64782 16.8632C4.57798 16.2969 3.70311 15.422 3.13682 14.3522C2.55779 13.2694 2.25 11.9873 2.25 10.2712V9.72875C2.25 8.01268 2.55779 6.73061 3.13682 5.64782C3.70341 4.57782 4.57868 3.70293 5.64893 3.13682C6.73061 2.55779 8.01268 2.25 9.72875 2.25Z"
        stroke={color ? color : "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InProgressIcon({ size = 18, className, color }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.72875 2.25H10.2712C11.9873 2.25 13.2694 2.55779 14.3522 3.13682C15.422 3.70311 16.2969 4.57798 16.8632 5.64782C17.4422 6.73061 17.75 8.01268 17.75 9.72875V10.2712C17.75 11.9873 17.4422 13.2694 16.8632 14.3522C16.2969 15.422 15.422 16.2969 14.3522 16.8632C13.2694 17.4422 11.9873 17.75 10.2712 17.75H9.72875C8.01268 17.75 6.73061 17.4422 5.64782 16.8632C4.57798 16.2969 3.70311 15.422 3.13682 14.3522C2.55779 13.2694 2.25 11.9873 2.25 10.2712V9.72875C2.25 8.01268 2.55779 6.73061 3.13682 5.64782C3.70341 4.57782 4.57868 3.70293 5.64893 3.13682C6.73061 2.55779 8.01268 2.25 9.72875 2.25Z"
        stroke={color ? color : "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.4281 12.8062C14.0628 13.4964 13.4983 14.0608 12.8081 14.4262C12.1095 14.7998 11.2824 14.9983 10.1753 14.9983H9.82526C8.71811 14.9983 7.89097 14.7998 7.1924 14.4262C6.50218 14.0608 5.93775 13.4964 5.5724 12.8062C5.36783 12.4237 5.21574 12.0026 5.12 11.5181C5.01016 10.9623 5.47637 10.4883 6.04292 10.4883H13.9576C14.5241 10.4883 14.9903 10.9623 14.8805 11.5181C14.7848 12.0026 14.6327 12.4237 14.4281 12.8062Z"
        fill={color ? color : "currentColor"}
      />
    </svg>
  );
}

function DoneIcon({ size = 18, className, color }: StatusIconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.72875 1.5C7.91879 1.5 6.50962 1.82576 5.2966 2.47473C4.09457 3.11097 3.11144 4.09371 2.47473 5.29549C1.82585 6.50948 1.5 7.91856 1.5 9.72875V10.2712C1.5 12.0814 1.82582 13.4904 2.47466 14.7044C3.11109 15.9061 4.09389 16.8889 5.29559 17.5253C6.50956 18.1742 7.91862 18.5 9.72875 18.5H10.2712C12.0813 18.5 13.4904 18.1742 14.7043 17.5254C15.9061 16.8889 16.8889 15.9061 17.5254 14.7043C18.1742 13.4904 18.5 12.0813 18.5 10.2712V9.72875C18.5 7.91862 18.1742 6.50956 17.5253 5.29559C16.8889 4.09389 15.9061 3.1111 14.7044 2.47466C13.4904 1.82582 12.0814 1.5 10.2712 1.5H9.72875ZM13.5326 8.83113C13.8255 8.53825 13.8255 8.06338 13.5326 7.77047C13.2398 7.47757 12.7649 7.47755 12.472 7.77043L9.00234 11.2398L7.52939 9.772C7.23599 9.47962 6.76111 9.48046 6.46874 9.77387C6.17636 10.0673 6.1772 10.5422 6.47061 10.8345L8.47386 12.8307C8.76689 13.1227 9.24103 13.1223 9.53356 12.8298L13.5326 8.83113Z"
        fill={color ? color : "currentColor"}
      />
    </svg>
  );
}

export const TASK_STATUS_META: Record<
  TaskStatus,
  {
    label: string;
    slot: string;
    Icon: (props: StatusIconProps) => React.ReactElement;
  }
> = {
  todo: { label: "Todo", slot: "3", Icon: TodoIcon },
  in_progress: { label: "In progress", slot: "4", Icon: InProgressIcon },
  done: { label: "Done", slot: "6", Icon: DoneIcon },
};

export function taskStatusColor(status: TaskStatus) {
  return getStatusColor(TASK_STATUS_META[status].slot);
}

export function TaskStatusIcon({
  status,
  size = 18,
  className,
}: {
  status: TaskStatus;
  size?: number;
  className?: string;
}) {
  const { Icon } = TASK_STATUS_META[status];
  return (
    <Icon size={size} className={className} color={taskStatusColor(status).color} />
  );
}
