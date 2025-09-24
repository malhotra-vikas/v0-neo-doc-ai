"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface NursingHomeOption {
  id: string
  name: string
}

interface NursingHomeSelectProps {
  nursingHomes: NursingHomeOption[]
  value: string | null | undefined
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  noResultsText?: string
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
}

export function NursingHomeSelect({
  nursingHomes,
  value,
  onChange,
  placeholder = "Select nursing home",
  searchPlaceholder = "Search nursing homes...",
  noResultsText = "No nursing homes found.",
  triggerClassName,
  contentClassName,
  disabled = false,
}: NursingHomeSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedHome = useMemo(
    () => nursingHomes.find((home) => home.id === value) ?? null,
    [nursingHomes, value],
  )

  const sortedHomes = useMemo(
    () => [...nursingHomes].sort((a, b) => a.name.localeCompare(b.name)),
    [nursingHomes],
  )

  const handleSelect = (homeId: string) => {
    onChange(homeId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => !disabled && setOpen(nextOpen)}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("justify-between", triggerClassName)}
        >
          {selectedHome?.name ?? placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-0 w-[280px]", contentClassName)} align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {sortedHomes.map((home) => (
                <CommandItem key={home.id} value={home.name} onSelect={() => handleSelect(home.id)}>
                  <Check className={cn("mr-2 h-4 w-4", home.id === value ? "opacity-100" : "opacity-0")} />
                  {home.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
