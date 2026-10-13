import { useDispatch, useSelector } from "react-redux"
import type { AppDispatch, RootState } from "./store"

/** The typed dispatch of the app's store. */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()

/** The typed selector of the app's store. */
export const useAppSelector = useSelector.withTypes<RootState>()
