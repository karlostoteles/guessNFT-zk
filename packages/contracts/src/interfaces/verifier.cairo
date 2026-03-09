/// Interface for the Garaga-generated UltraKeccakZKHonk verifier contract.
/// ABI produced by `garaga gen --system ultra_keccak_zk_honk`.
#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState,
        full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}
