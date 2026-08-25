import { WarningIcon } from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

type TextFieldProps = ComponentProps<'input'> & {
  label: string
  prefix?: string
  error?: string
}

export function TextField({
  label,
  prefix,
  error,
  className,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    // `group` + `data-error` levam o estado às partes internas por CSS.
    // Foco e conteúdo NÃO são espelhados em useState: o navegador já os
    // mantém em :focus-within e :placeholder-shown, e uma cópia em React
    // dessincroniza com autofill e com setValue do React Hook Form
    <div
      className="group flex flex-col gap-2"
      data-error={error ? true : undefined}
    >
      <label
        htmlFor={inputId}
        className={cn(
          'text-xs uppercase transition-colors',
          'text-gray-500',
          'group-focus-within:text-blue-base',
          'group-data-[error]:text-danger'
        )}
      >
        {label}
      </label>

      <div
        className={cn(
          'flex h-12 items-center rounded-lg border-[1.5px] bg-white px-4',
          'border-gray-300 transition-colors',
          'group-focus-within:border-blue-base',
          'group-data-[error]:border-danger'
        )}
      >
        {prefix && (
          // `group-has-[...]` e não `peer-[...]`: o modificador `peer` só
          // alcança irmãos POSTERIORES, e este span vem antes do input.
          // `:has()` no grupo funciona porque o wrapper contém os dois.
          <span className="text-md font-normal text-gray-400 group-has-[input:not(:placeholder-shown)]:text-gray-600">
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          // React 19 trata `ref` como prop comum, então o spread abaixo
          // repassa o ref que o `register()` do React Hook Form injeta —
          // sem isso o campo ficaria fora do controle do formulário
          className={cn(
            'flex-1 bg-transparent text-md font-normal text-gray-600 outline-none',
            'caret-blue-base placeholder:text-gray-400',
            className
          )}
          {...props}
        />
      </div>

      {error && (
        <p
          id={errorId}
          className="flex items-center gap-2 text-sm text-gray-500"
        >
          <WarningIcon className="size-4 shrink-0 text-danger" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
