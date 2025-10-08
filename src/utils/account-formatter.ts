import { BN } from "@project-serum/anchor"
import { PublicKey } from '@solana/web3.js'
import { IdlEnumVariant, IdlField, IdlTypeDef } from "@project-serum/anchor/dist/cjs/idl"
import { IdlField as IdlFieldV3, IdlTypeDef as IdlTypeDefV3, IdlEnumVariant as IdlEnumVariantV3 } from "@coral-xyz/anchor/dist/cjs/idl";

type IdlFields = 'u8' | 'u16' | 'u32' | 'u64' | 'u128' | 'u256'
| 'i8' | 'i16' | 'i32' | 'i64' | 'i128' | 'i256'
| 'f32' | 'f64' | 'f128'
| 'publicKey' | 'pubkey' | 'bool' | 'string' | 'bytes'

const asIs = (f: any) => f
const BORSH_TO_DB_MAPPINGS: Record<IdlFields, Function> = {
  u8: asIs,
  u16: asIs,
  u32: asIs,
  u64: (t: BN) => t.toString(10),
  u128: (t: BN) => t.toString(10),
  u256: (t: BN) => t.toString(10),
  i8: asIs,
  i16: asIs,
  i32: asIs,
  i64: (t: BN) => t.toString(10),
  i128: (t: BN) => t.toString(10),
  i256: (t: BN) => t.toString(10),
  f32: asIs,
  f64: (t: BN) => t.toString(10),
  f128: (t: BN) => t.toString(10),
  publicKey: (t: PublicKey) => t?.toBase58(),
  pubkey: (t: PublicKey) => t?.toBase58(),
  bool: asIs,
  //string: asIs,
  //adding a filter for strings with null characters, causing errors while inserting in postgres
  string: (t: string) => {
    t = t.replace(/\0/g, '')
    return t.toString()
  }, 
  bytes: asIs,
}

function serializeField(input: any, field: IdlField | IdlFieldV3, types: IdlTypeDef[] | IdlTypeDefV3[] | undefined): any {
  if (typeof field.type === 'object') {
    if ('option' in field.type) {
      const newField = { name: field.name, type: field.type.option } as IdlField | IdlFieldV3;
      return input ? serializeField(input, newField, types) : null;
    } else if ('vec' in field.type) {
      const type = field.type.vec
      const newField = {name: field.name, type: type } as IdlField | IdlFieldV3;
      return input.map((i: any) => serializeField(i, newField, types))
    } else if ('array' in field.type) {
      const [fieldType] = field.type.array
      const newField = {name: field.name, type: fieldType } as IdlField | IdlFieldV3;
      return input.map((i: any) => serializeField(i, newField, types))
    } else if ('defined' in field.type) {
      
      let definedType:string;
      
      if(typeof field.type.defined !== 'string') {
        definedType = field.type.defined.name
      } else {
        definedType = field.type.defined
      }

      if (!types) {
        throw new Error(`Types not defined in current idl. Failed while trying to find ${definedType}`)
      }

      const type = types.find(t => t.name === definedType)

      if (!type) {
        throw new Error(`Cannot find given type, ${definedType} in idl while serializing field ${field.name}`)
      }

      return serializeDefinedType(input, type, types)
    } else {
      throw new Error(`Invalid field type. Input: ${JSON.stringify(field)}`)
    }
  }

  const mapping = BORSH_TO_DB_MAPPINGS[field.type]
  if (!mapping) {
    throw new Error(`Unknown idl field type ${field.type}`)
  }

  return mapping(input)
}

function serializeDefinedType(input: any, type: IdlTypeDef | IdlTypeDefV3, allTypes: IdlTypeDef[] | IdlTypeDefV3[]) {
  // console.log("input:123123123 ");
  //   console.dir(input,{depth: null})
    
  if (type.type.kind === 'enum') {
    // console.log("Type came enum: ");
    return serializeEnum(input, type.type.variants, allTypes)
  } else if (type.type.kind === 'struct') {
    // console.log("Type came struct: ");

    const newField = type.type.fields! as IdlFieldV3[] | IdlField[];
    // console.log("New field value: ", newField);
    return serializeStruct(input, newField, allTypes)
  } else {
    throw new Error(`Unknown deifned kind ${JSON.stringify(type.type)} while serliazing input ${JSON.stringify(input)}`)
  }
}

export function serializeStruct(input: any, type: IdlFieldV3[] | IdlField[], allTypes: IdlTypeDef[] | IdlTypeDefV3[] | undefined) {
  const result: any = {}
  for (const field of type) {
    const newField = { name: '', type: field.type } as IdlField | IdlFieldV3
    
    result[field.name] = serializeField(input[field.name], newField, allTypes)
  }

  return result
}

function serializeEnum(input: any, variants: IdlEnumVariant[] | IdlEnumVariantV3[] , allTypes: IdlTypeDef[] | IdlTypeDefV3[]) {
  const variant = Object.keys(input)[0]
  const lowerCaseVariant = variant.toLowerCase()

  const serializer = variants.find(v => v.name.toLowerCase() === lowerCaseVariant)

  if (!serializer) {
    throw new Error(`Invalid enum variant ${variant} for field ${JSON.stringify(input)}`)
  }

  return { [variant]: serializeEnumFields(input[variant], serializer, allTypes) }
}

function serializeEnumFields(input: any, enumVariant: IdlEnumVariant | IdlEnumVariantV3, allTypes: IdlTypeDef[] | IdlTypeDefV3[]) {
  const inputKeys = Object.keys(input)

  if (inputKeys.length === 0) {
    return {}
  }

  const result: any = {}
  for (const field of enumVariant.fields!) {
    if (typeof field === 'string' || !('name' in field)) {
      throw new Error(`Not implemented tuple serialization for enum.`)
    } else if ('name' in field) {
      // console.log("Enum Field name: ", field.name);
      // console.dir(input[field.name], {depth: null})
      
      result[field.name] = serializeField(input[field.name], field, allTypes);
    }
  }

  return result
}
