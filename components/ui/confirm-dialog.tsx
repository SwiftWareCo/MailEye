/**
 * Reusable Confirm Dialog Component
 *
 * A confirmation dialog for destructive actions (delete, etc.)
 * Uses shadcn/ui AlertDialog for accessibility and consistency
 */

'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  /**
   * The trigger element (usually a button)
   */
  trigger: React.ReactNode;

  /**
   * Dialog title
   */
  title: string;

  /**
   * Dialog description/message
   */
  description: string;

  /**
   * Confirm button text (default: "Continue")
   */
  confirmText?: string;

  /**
   * Cancel button text (default: "Cancel")
   */
  cancelText?: string;

  /**
   * Callback when user confirms
   */
  onConfirm: () => void | Promise<void>;

  /**
   * Optional callback when user cancels
   */
  onCancel?: () => void;

  /**
   * Whether the action is destructive (shows red button)
   * Default: true
   */
  destructive?: boolean;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmText = 'Continue',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={
              destructive
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                : ''
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
