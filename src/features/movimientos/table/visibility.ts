"use client";

import type { Rol } from "@/app/Components/movimientos/useMovimientos";
import {
  canViewMovementDuration as canViewDurationByRole,
  isClientLikeRole as isClientLikeRoleByPolicy,
} from "@/lib/accessControl";

export function isClientLikeRole(role?: Rol | string | null) {
  return isClientLikeRoleByPolicy(role);
}

export function canViewMovementDuration(role?: Rol | string | null) {
  return canViewDurationByRole(role);
}

export const canViewMovementTiming = canViewMovementDuration;
